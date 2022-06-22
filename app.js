require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const multer = require("multer");
const path = require("path");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const localGoogleUser = require('./local-google-user');
const flash = require('connect-flash');
cookieParser = require('cookie-parser')

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(cookieParser());

app.use(session({
  secret: "WeRescue",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

mongoose.connect("mongodb://localhost:27017/weRescueDB");

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/volunteerImages/')
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
  }
});
var upload = multer({
  storage: storage
}).single('profileImage');

var storage2 = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/healthOfficialImages/')
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
  }
});
var upload2 = multer({
  storage: storage2
}).single('profileImage');

var storage1 = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/postImages/')
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
  }
});
var upload1 = multer({
  storage: storage1
}).single('postImage');

let profileImg = "";
let status = "";
let postSize = 0;
let volunteerPost = [];

const userSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  password: String,
  googleId: String,
  mobileno: String,
  address: String,
  profileImage: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
  volunteerID: mongoose.Schema.Types.ObjectId,
  volunteerName: String,
  email: String,
  mobileno: String,
  address: String,
  description: String,
  dateAndTime: String,
  relatedImage: String,
  reviewedBy: String,
  emergencyAlert: String,
  comments: String,
  chat: [{
    sender: String,
    senderType: String,
    msg: String,
    dateAndTime: String
  }]
});
const Post = mongoose.model("Post", postSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/volunteerInterface",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
  function (accessToken, refreshToken, profile, cb) {
    if (User.findOne({ googleId: profile.id })) {
      localGoogleUser.currentUser = {
        googleId: profile.id,
        username: profile.emails[0].value,
        fullname: profile.name.givenName + " " + profile.name.familyName,
      }
    }

    User.findOrCreate({
      googleId: profile.id
    }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  })
);

app.get('/auth/google/volunteerInterface',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function (req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/checkProfileAttributes');
  });

app.listen(3000, function () {
  console.log("Server started successfully at port 3000");
});

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  res.render("login", { messages: req.flash("status") });
});

app.get("/register", function (req, res) {
  res.render("register", { messages: req.flash("status") });
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/setProfileAttributes", function (req, res) {
  res.render("setProfileAttributes", { ejs_googleUser: localGoogleUser.currentUser });
});

app.get("/checkProfileAttributes", function (req, res) {
  User.findOne({
    _id: req.user.id
  }, function (err, docs) {
    if (err) {
      console.log(err);
      req.flash("status", [false, err.message]);
      res.redirect("/login");
    } else {
      if (!docs.username) {
        res.redirect("/setProfileAttributes");
      } else {
        res.redirect("/volunteerInterface");
      }
    }
  });
  // }
});

app.get("/volunteerInterface", function (req, res) {
  User.findOne({
    _id: req.user.id
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      volunteerPost = [];
      Post.find(function (err, foundPost) {
        if (!err) {
          for (let i = 0; i < foundPost.length; i++) {
            if (docs._id.equals(foundPost[i].volunteerID)) {
              volunteerPost.push(foundPost[i]);
            }
          }

          if (!docs.profileImage) {
            profileImg = "defaultProfile.jpg";
          } else {
            profileImg = docs.profileImage;
          }

          res.render("volunteerInterface", {
            username: docs.username,
            fullname: docs.fullname,
            mobileno: docs.mobileno,
            address: docs.address,
            profileImage: profileImg,
            volunteerPost: volunteerPost
          });
        } else {
          console.log(err);
        }
      });
    }
  });
});

app.get("/editInfo", function (req, res) {
  User.findOne({
    _id: req.user.id
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      if (!docs.profileImage) {
        profileImg = "defaultProfile.jpg";
      } else {
        profileImg = docs.profileImage;
      }

      res.render("editInfo.ejs", {
        fullname: docs.fullname,
        mobileno: docs.mobileno,
        address: docs.address,
        username: docs.username,
        profileImage: profileImg
      });
    }
  });
});

app.get("/createPost", function (req, res) {
  User.findOne({
    _id: req.user.id
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      if (!docs.profileImage) {
        profileImg = "defaultProfile.jpg";
      } else {
        profileImg = docs.profileImage;
      }

      res.render("createPost.ejs", {
        fullname: docs.fullname,
        mobileno: docs.mobileno,
        address: docs.address,
        username: docs.username,
        profileImage: profileImg,
        volunteerPost: volunteerPost
      });
    }
  });
});

app.post("/register", upload, function (req, res) {
  User.register({
    username: req.body.username,
    fullname: req.body.fullname,
    address: req.body.address,
    mobileno: req.body.mobileno,
    // profileImage: req.file.filename
  }, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      req.flash("status", [false, err.message]);
      res.redirect("/register");
      // res.status(400).send(err.message);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/checkProfileAttributes");
      })
    }
  });
});

app.post('/login', function (req, res, next) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  passport.authenticate('local', function (err, user, info) {
    if (err) {
      req.flash("status", [false, "Invalid username or password"]);
      return next(err);
    }
    if (!user) {
      console.log("User not found!");
      req.flash("status", [false, "Invalid username or password"]);
      return res.redirect('/login');
    }
    req.logIn(user, function (err) {
      if (err) {
        req.flash("status", [false, "Invalid username or password"]);
        return next(err);
      }

      return res.redirect("/checkProfileAttributes");
    });
  })(req, res, next);
});

app.post("/setProfileAttributes", upload, function (req, res) {
  User.updateOne({
    _id: req.user.id
  }, {
    username: req.body.username,
    fullname: req.body.fullname,
    mobileno: req.body.mobileno,
    address: req.body.address,
    // profileImage: req.file.filename
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      console.log("Updated Docs: ", docs);
      res.redirect("/volunteerInterface");
    }
  });
});

app.post("/editInfo", upload, function (req, res) {
  User.updateOne({
    _id: req.user.id
  }, {
    username: req.body.username,
    fullname: req.body.fullname,
    mobileno: req.body.mobileno,
    address: req.body.address,
    // profileImage: req.file.filename
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      console.log("Updated Docs : ", docs);
      res.redirect("/volunteerInterface");
    }
  });
});

app.post("/editProfileImage", upload, function (req, res) {
  User.updateOne({
    _id: req.user.id
  }, {
    profileImage: req.file.filename
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      console.log("Updated Docs : ", docs);
      res.redirect("/volunteerInterface");
    }
  });
});

app.post("/createPost", upload1, function (req, res) {
  let dateAndTime = new Date().toLocaleString();
  User.findOne({
    _id: req.user.id
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      const post = new Post({
        volunteerID: docs._id,
        volunteerName: docs.fullname,
        email: docs.username,
        mobileno: docs.mobileno,
        address: req.body.address,
        description: req.body.description,
        dateAndTime: dateAndTime,
        relatedImage: req.file.filename
      });
      post.save(function (err) {
        if (!err) {
          console.log("Added new post");
          res.redirect("/volunteerInterface");
        } else {
          console.log(err);
        }
      });
    }
  });
})


// Health Officials
var currUserId;
var currUserName;
let unReviwedPost = [];
let postReviewedByCurrOfficial = [];

var reviewerEmail;
var reviewerMobileNo;

const healthOfficialSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  userName: String,
  s_pin: String,
  mobileno: String,
  address: String,
  profileImage: String
});
const Offical = mongoose.model("Official", healthOfficialSchema);

app.get("/healthOfficialLogin", function (req, res) {
  res.render("healthOfficialLogin", { messages: req.flash("status") });
});

app.get("/healthOfficialInterface", function (req, res) {
  Offical.findOne({
    userName: currUserName
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      unReviwedPost = [];
      postReviewedByCurrOfficial = []
      Post.find(function (err, foundPost) {
        if (!err) {
          for (let i = 0; i < foundPost.length; i++) {
            // console.log(foundPost.reviewedBy);
            if (!foundPost[i].reviewedBy) {
              unReviwedPost.push(foundPost[i]);
            }
            if (foundPost[i].reviewedBy === currUserName) {
              postReviewedByCurrOfficial.push(foundPost[i]);
            }
          }

          if (!docs.profileImage) {
            profileImg = "defaultProfile.jpg";
          } else {
            profileImg = docs.profileImage;
          }

          res.render("healthOfficialInterface", {
            username: docs.userName,
            fullname: docs.fullname,
            mobileno: docs.mobileno,
            address: docs.address,
            profileImage: profileImg,
            unReviwedPost: unReviwedPost,
            postReviewed: postReviewedByCurrOfficial
          });
        } else {
          console.log(err);
        }
      });

      //   if(!docs.profileImage){
      //     profileImg = "defaultProfile.jpg";
      //   } else{
      //     profileImg = docs.profileImage;
      //   }
      //   res.render("healthOfficialInterface", {
      //      username: docs.userName,
      //      fullname: docs.fullname,
      //      mobileno: docs.mobileno,
      //      address: docs.address,
      //      profileImage: profileImg
      //   });
    }
  });
});

app.get("/healthOfficialSetProfileAttributes", function (req, res) {
  res.render("healthOfficialSetProfileAttributes");
});

app.get("/healthOfficialEditInfo", function (req, res) {
  Offical.findOne({
    userName: currUserName
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      if (!docs.profileImage) {
        profileImg = "defaultProfile.jpg";
      } else {
        profileImg = docs.profileImage;
      }

      res.render("healthOfficialEditInfo", {
        fullname: docs.fullname,
        mobileno: docs.mobileno,
        address: docs.address,
        username: docs.userName,
        email: docs.email,
        profileImage: profileImg
      });
    }
  });
});

app.get("/reviewedPostDetails/:postId", function (req, res) {
  // console.log(req.params.postId);
  Post.findOne({ _id: mongodb.ObjectId(req.params.postId) }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      Offical.findOne({
        userName: docs.reviewedBy
      }, function (err, docs1) {
        if (err) {
          console.log(err)
        } else {
          reviewerEmail = docs1.email;
          reviewerMobileNo = docs1.mobileno;
        }
      });

      res.render("reviewedPostDetails", {
        postId: docs._id,
        relatedImage: docs.relatedImage,
        address: docs.address,
        description: docs.description,
        dateAndTime: docs.dateAndTime,
        reviewedBy: docs.reviewedBy,
        CommentByOfficial: docs.comments,
        emergencyAlert: docs.emergencyAlert,
        reviewerEmail: reviewerEmail,
        reviewerMobileNo: reviewerMobileNo,
        chat: docs.chat
      });
    }
  });
});

app.get("/healthOfficialReviewedPostDetails/:postId", function (req, res) {
  Post.findOne({ _id: mongodb.ObjectId(req.params.postId) }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      res.render("healthOfficialReviewedPostDetails", {
        postId: docs._id,
        relatedImage: docs.relatedImage,
        volunteerName: docs.volunteerName,
        volunteerEmail: docs.email,
        volunteerMobileno: docs.mobileno,
        address: docs.address,
        description: docs.description,
        dateAndTime: docs.dateAndTime,
        CommentByOfficial: docs.comments,
        emergencyAlert: docs.emergencyAlert,
        chat: docs.chat
      });
    }
  });
});

app.post("/healthOfficialLogin", function (req, res) {
  Offical.findOne({
    userName: req.body.username
  }, function (err, docs) {
    if (err) {
      console.log(err);
      req.flash("status", [false, err.message]);
      res.redirect("/healthOfficialLogin");
    } else {
      if (docs != null && docs.s_pin === req.body.s_pin) {
        currUserId = docs._id;
        currUserName = docs.userName;

        if (!docs.fullname) {
          res.redirect("/healthOfficialSetProfileAttributes");
        } else {
          res.redirect("/healthOfficialInterface");
        }
      } else {
        req.flash("status", [false, "Invalid username or password"]);
        res.redirect("/healthOfficialLogin");
      }

    }
  });
});

app.post("/healthOfficialSetProfileAttributes", upload2, function (req, res) {
  console.log(currUserName);
  console.log(typeof (currUserName));
  Offical.updateOne({
    userName: currUserName
  }, {
    email: req.body.email,
    fullname: req.body.fullname,
    mobileno: req.body.mobileno,
    address: req.body.address,
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      console.log("Updated Docs: ", docs);
      res.redirect("/healthOfficialInterface");
    }
  });
});

app.post("/healthOfficialInterface", function (req, res) {
  console.log(req.body.postId);
  console.log(typeof (req.body.postId));
  console.log(req.body.alert);
  console.log(req.body.comments);

  Post.updateOne({
    _id: mongodb.ObjectId(req.body.postId)
  }, {
    reviewedBy: currUserName,
    emergencyAlert: req.body.alert,
    comments: req.body.comments,
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      console.log("Updated Docs: ", docs);
      res.redirect("/healthOfficialInterface");
    }
  });
});

app.post("/healthOfficialEditInfo", upload2, function (req, res) {
  Offical.updateOne({
    userName: currUserName
  }, {
    username: req.body.username,
    fullname: req.body.fullname,
    email: req.body.email,
    mobileno: req.body.mobileno,
    address: req.body.address,
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      console.log("Updated Docs : ", docs);
      res.redirect("/healthOfficialInterface");
    }
  });
});

app.post("/healthOfficialEditProfileImage", upload2, function (req, res) {
  Offical.updateOne({
    userName: currUserName
  }, {
    profileImage: req.file.filename
  }, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      console.log("Updated Docs : ", docs);
      res.redirect("/healthOfficialInterface");
    }
  });
});

app.post("/reviewedPostDetails/:postId", function (req, res) {
  console.log(req.params.postId);
  Post.updateOne({
    _id: mongodb.ObjectId(req.params.postId)
  }, {
    $push: {
      chat: [{
        sender: req.body.sender, senderType: req.body.senderType, msg: req.body.msg, dateAndTime: req.body.dateAndTime
      }
      ]
    }
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      console.log("Updated Docs: ", docs);
      res.redirect("/reviewedPostDetails/" + req.params.postId);
    }
  });
})

app.post("/healthOfficialReviewedPostDetails/:postId", function (req, res) {
  Post.updateOne({
    _id: mongodb.ObjectId(req.params.postId)
  }, {
    $push: {
      chat: [{
        sender: req.body.sender, senderType: req.body.senderType, msg: req.body.msg, dateAndTime: req.body.dateAndTime
      }
      ]
    }
  }, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      console.log("Updated Docs: ", docs);
      res.redirect("/healthOfficialReviewedPostDetails/" + req.params.postId);
    }
  });
})
