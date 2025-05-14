require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
      newPost.total_volunteer_need =
        parseInt(newPost.total_volunteer_need) || 0;
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
    app.get("/my-posts", async (req, res) => {
      const userEmail = req.query.userEmail;
      // console.log("organizer_email:", userEmail)
      if (!userEmail) {
        return res.status(400).send("User email is required");
      }
      const query = { organizer_email: userEmail };
      const cursor = postCollection.find(query);
      const posts = await cursor.toArray();
      res.json(posts);
    });

    // update post
    app.put("/update-my-post/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const updatePost = req.body;
      const updateDoc = {
        $set: updatePost,
      };
      const result = await postCollection.updateOne(query, updateDoc);
      res.json(result);
    })

    // delete my post
    app.delete("/delete-my-post/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await postCollection.deleteOne(query);
      res.json(result);
    })

    // be a volunteer
    app.post("/be-volunteer", async (req, res) => {
      const request = req.body;
      const postId = request.post_id;

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
        res
          .status(500)
          .json({
            success: false,
            message: "Server Error",
            error: error.message,
          });
      }
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
