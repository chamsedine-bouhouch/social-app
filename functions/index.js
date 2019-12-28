const functions = require("firebase-functions");
const admin = require("firebase-admin");
// using express
const app = require("express")();
// const config fro firebase
const firebaseConfig = {
  apiKey: "AIzaSyCSh2LMhZCYu7jArp6sH4o9d2JZRaYk8tw",
  authDomain: "react-1933c.firebaseapp.com",
  databaseURL: "https://react-1933c.firebaseio.com",
  projectId: "react-1933c",
  storageBucket: "react-1933c.appspot.com",
  messagingSenderId: "622713787408",
  appId: "1:622713787408:web:5b5ec7951c6e5dc6d8a695",
  measurementId: "G-5ZGD9546YL"
};

admin.initializeApp();

//firebase config
const firebase = require("firebase");
firebase.initializeApp(firebaseConfig);
//using db as abbreviation
const db = admin.firestore();

app.get("/screens", (req, res) => {
  db.collection("screens")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let screens = [];
      data.forEach(doc => {
        screens.push({
          screenId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt
        });
      });
      return res.json(screens);
    })
    .catch(err => console.error(err));
});

//midllware
const FBAuth = (req, res, next) => {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("No token found");
    return res.status(403).json({ error: "Unauthorized" });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      console.log(decodedToken);
      return db
        .collection("users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then(data => {
      req.user.handle = data.docs[0].data().handle;
      return next();
    })
    .catch(err => {
      console.error("Error while verifying token ", err);
      return res.status(403).json(err);
    });
};

app.post("/screens", FBAuth, (req, res) => {
  const newScreen = {
    body: req.body.body,
    userHandle: req.user.handle,
    createdAt: new Date().toISOString()
  };
  db.collection("screens")
    .add(newScreen)
    .then(doc => {
      res.json({ message: `document ${doc.id} created successfully` });
    })
    .catch(err => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
});

// validate email
const isEmail = email => {
  const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(regEx)) return true;
  else return false;
};
//
const isEmpty = string => {
  if (string.trim() === "") return true;
  else return false;
};

// Signup route
app.post("/signup", (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  };

  let errors = {};
  if (isEmpty(newUser.email)) {
    errors.email = "Must not be empty";
  } else if (!isEmail(newUser.email)) {
    return (errors.email = "Must be a valid mail adress");
  }
  //pasword validation
  if (isEmpty(newUser.password)) errors.password = "Must not be empty";
  if (newUser.password !== newUser.confirmPassword)
    errors.confirm = "Passwords must match";
  if (isEmpty(newUser.handle)) errors.handle = "Must not be empty";
  //test that errors is empty
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  let token, userId;
  //validate data
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        userId
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ email: "email already in use" });
      } else {
        return res.status(500).json({ error: err.code });
      }
    });
});

//Login route
app.post("/login", (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  };

  let errors = {};

  if (isEmpty(user.email)) errors.email = "Must not be empty";
  if (isEmpty(user.password)) errors.password = "Must not be empty";
  if (Object.keys(errors).length > 0) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        return res
          .status(403)
          .json({ password: "Wrong password, please try again" });
      } else {
        return res.status(500).json({ error: err.code });
      }
    });
});

// hhtps://baseurl.com/api/
exports.api = functions.https.onRequest(app);
