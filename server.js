const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { request } = require("http");

const app = express();
app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "database.db");

const server = app.listen(3001, () => {
  console.log("Server is running at http://localhost:3001");
});

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "PUT", "POST", "DELETE"],
  },
});

let db;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (error) {
    console.log("DB Error: ", error.message);
  }
};
initializeDBAndServer();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let otp = null;

const sendingOtp = async (mail) => {
  try {
    await transporter.sendMail({
      from: '"Uday Team" kgpiitianganesha@gmail.com',
      to: mail,
      subject: "Your OTP Code",
      text: `Your verification code is ${otp}`,
    });
  } catch (err) {
    console.error(err);
  }
};

io.on("connection", (socket) => {
  socket.on("entered_mail", (data) => {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
    sendingOtp(data);
    socket.emit("otp_generated", otp);
  });

  socket.on("update_db", () => {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
    io.emit("db_updated", otp);
  });
});

app.post("/users/", async (request, response) => {
  const { username, name, email } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE mail = '${email}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const selectUsernameQuery = `SELECT * FROM users WHERE username = '${username}';`;
    const dbUsername = await db.get(selectUsernameQuery);
    if (dbUsername === undefined) {
      const createUserQuery = `INSERT INTO users (username, name, mail) 
    VALUES ('${username}', '${name}', '${email}');`;
      await db.run(createUserQuery);
      response.send({ msg: "User created successfully" });
    } else {
      response.send({ msg: "Username already exists" });
    }
  } else {
    response.status(400);
    response.send({ msg: "User already exists" });
  }
});

app.post("/login/", async (request, response) => {
  const { usernameOrMail } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${usernameOrMail}' 
  OR mail = '${usernameOrMail}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.send({ msg: "User not found" });
  } else {
    response.send({ msg: "User found" });
  }
});

app.post("/user", async (request, response) => {
  const { userMail } = request.body;
  const selectUserDetailsQuery = `SELECT * FROM users WHERE mail = '${userMail}';`;
  const dbUserDetails = await db.get(selectUserDetailsQuery);
  if (dbUserDetails) {
    response.send(dbUserDetails);
  }
});

app.post("/comments/", async (request, response) => {
  const { userid, comment, postid, username } = request.body;
  const insertCommentQuery = `INSERT INTO comments (userid, comment, postid, username) 
  VALUES (${userid}, '${comment}', ${postid}, '${username}')`;
  await db.run(insertCommentQuery);
  response.send({ msg: "Comment added" });
});

app.get("/comments/", async (request, response) => {
  const selectCommentsQuery = `SELECT * FROM comments`;
  const dbCommentsData = await db.all(selectCommentsQuery);
  if (dbCommentsData) {
    response.send(dbCommentsData);
  }
});

app.delete("/comments", async (request, response) => {
  const { commentid } = request.body;
  const deleteCommentQuery = `DELETE FROM comments WHERE id = ${commentid}`;
  await db.run(deleteCommentQuery);
  response.send({ msg: "Comment deleted" });
});
