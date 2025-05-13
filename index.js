require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
      const result = await postCollection.insertOne(newPost);
      res.json(result);
    });

    // get all post
    app.get("/posts", async (req, res) => {
      const cursor = postCollection.find({});
      const posts = await cursor.toArray();
      res.json(posts);
    })

    // get limited post by ascending order
    app.get("/limited-posts", async (req, res) => {
      const cursor = postCollection.find({}).sort({deadline: 1}).limit(6);
      const limitedPost = await cursor.toArray();
      res.json(limitedPost);
    })

    // get post details
    app.get("/post-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const post = await postCollection.findOne(query);
      res.json(post);
    })

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
