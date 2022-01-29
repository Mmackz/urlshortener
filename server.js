require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dns = require("dns");
const bodyParser = require("body-parser");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

// Basic Configuration
const port = process.env.PORT || 3000;
app.use(cors());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// DB setup
const mongoDB = process.env.DB_URI;
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

const urlSchema = mongoose.Schema({
   original: {
      type: String,
      required: true,
      maxLength: 100
   }
});

// auto-increment the id field
urlSchema.plugin(AutoIncrement, { inc_field: "short_url" });

const Url = mongoose.model("Url", urlSchema);

app.get("/", function (req, res) {
   res.render("index");
});

app.get("/api/shorturl", (req, res) => {
   res.json({ error: "No ID supplied. usage: /api/shorturl/:id" });
});

app.get("/api/shorturl/:id", (req, res, next) => {
   // make sure id param is a valid integer greater than 0
   if (req.params.id.startsWith("0") || !/^\d+$/.test(req.params.id)) {
      res.json({ error: "Invalid URL" });
   } else {
      // search the db for the id
      Url.findOne({ short_url: req.params.id }, (err, data) => {
         if (err) return next(err);
         if (data === null) {
            // if not found, display error
            res.json({ error: "No short URL found for the given input" });
         } else {
            // if found, redirect to original url
            res.redirect(data.original);
         }
      });
   }
});

app.post("/api/shorturl", (req, res, next) => {
   // reject if input does not begin with http
   if (!req.body.url.startsWith("http")) {
      res.json({ error: "Invalid URL" });
   } else {
      const url = new URL(req.body.url);
      dns.lookup(url.hostname, (err) => {
         // reject if dns lookup fails
         if (err) res.json({ error: "Invalid Hostname" });
         else {
            // look for previous entries of url in db
            Url.findOne({ original: req.body.url }, (err, data) => {
               if (err) return next(err);
               // if no entries found, insert data
               if (data === null) {
                  const shortUrl = new Url({ original: req.body.url });
                  shortUrl.save((err, data) => {
                     if (err) return next(err);
                     res.json({
                        original_url: data.original,
                        short_url: data.short_url
                     });
                  });
               } else {
                  // else display data already present in db
                  res.json({
                     original_url: data.original,
                     short_url: data.short_url
                  });
               }
            });
         }
      });
   }
});

app.listen(port, function () {
   console.log(`Listening on port ${port}`);
});
