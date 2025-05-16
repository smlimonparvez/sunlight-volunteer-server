require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://sunlight-volunteer.web.app",
      "https://sunlight-volunteer.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.w3tuc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const postCollection = client.db("volunteer").collection("add_post");
    const beVolunteerCollection = client
      .db("volunteer")
      .collection("be_volunteer");

    // auth api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // logout
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // add post
    app.post("/add-post", async (req, res) => {
      const newPost = req.body;
      if (
        !newPost ||
        typeof newPost !== "object" ||
        !newPost.post_title ||
        !newPost.description
      ) {
        return res.status(400).json({ error: "Invalid post data" });
      }
      newPost.total_volunteer_need = Number(newPost.total_volunteer_need) || 0;
      const result = await postCollection.insertOne(newPost);
      res.json(result);
    });

    // get all post
    app.get("/posts", async (req, res) => {
      const cursor = postCollection.find({});
      const posts = await cursor.toArray();
      res.json(posts);
    });

    // get limited post by ascending order
    app.get("/limited-posts", async (req, res) => {
      const cursor = postCollection.find({}).sort({ deadline: 1 }).limit(6);
      const limitedPost = await cursor.toArray();
      res.json(limitedPost);
    });

    // get post details
    app.get("/post-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const post = await postCollection.findOne(query);
      res.json(post);
    });

    // get post for logged in user
    app.get("/my-posts", verifyToken, async (req, res) => {
      const userEmail = req.query.userEmail;
      // console.log("organizer_email:", userEmail)

      if (!userEmail) {
        return res.status(400).send("User email is required");
      }
      const query = { organizer_email: userEmail };

      // console.log(req.cookies?.token)
      // token email !== query email
      if (req.user.email !== req.query.userEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const cursor = postCollection.find(query);
      const posts = await cursor.toArray();
      res.json(posts);
    });

    // update post
    app.put("/update-my-post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatePost = req.body;
      delete updatePost._id; // Ensure _id is not included in the update
      const updateDoc = {
        $set: updatePost,
      };
      const result = await postCollection.updateOne(query, updateDoc);
      res.json(result);
    });

    // delete my post
    app.delete("/delete-my-post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
      res.json(result);
    });

    // be a volunteer
    app.post("/be-volunteer", async (req, res) => {
      const request = req.body;
      const postId = request._id;

      try {
        // Check if volunteers are still needed
        const post = await postCollection.findOne({
          _id: new ObjectId(postId),
        });

        if (!post || post.total_volunteer_need <= 0) {
          return res
            .status(400)
            .json({ success: false, message: "No more volunteers needed" });
        }

        // Insert volunteer request
        await beVolunteerCollection.insertOne(request);

        // Decrement total volunteers needed
        await postCollection.updateOne(
          { _id: new ObjectId(postId) },
          { $inc: { total_volunteer_need: -1 } }
        );

        res
          .status(200)
          .json({ success: true, message: "Volunteer request submitted" });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Server Error",
          error: error.message,
        });
      }
    });

    // be a volunteer post by logged in user
    app.get("/be-volunteer-posts", async (req, res) => {
      const userEmail = req.query.userEmail;
      // console.log("organizer_email:", userEmail)
      if (!userEmail) {
        return res.status(400).send("User email is required");
      }
      const query = { organizer_email: userEmail };
      const cursor = beVolunteerCollection.find(query);
      const posts = await cursor.toArray();
      res.json(posts);
    });

    // delete be volunteer post
    app.delete("/delete-be-volunteer-post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await beVolunteerCollection.deleteOne(query);
      res.json(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World, Server is Ready");
});

app.listen(port, () => {
  console.log(`Server is listening on port: ${port}`);
});
