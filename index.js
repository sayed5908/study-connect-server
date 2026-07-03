const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 3000;
require('dotenv').config();

const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

//cookies
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.use(cors({
  origin: [
    "https://api-study-connect.onrender.com",
    "https://study-connect-e0a65.web.app",
    "https://study-connect-e0a65.firebaseapp.com"
  ],
  credentials: true,
}));
app.use(express.json());





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.skmy7gb.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if(!token){
    return res.status(401).send({ message: "unauthorize access"})
  }

  jwt.verify(
    token, 
    process.env.JWT_SECRET,
    (err, decoded) => {
      if(err) {
        return res.status(403).send({message: "Forbidden"});
      }
      req.user = decoded;

      next();
    }
  );
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('study_connect').collection('users');
    const assignmentCollection = client.db('study_connect').collection('assignments');
    const submittedAssignmentCollection = client.db('study_connect').collection('submittedAssignment');


    //jwt authentication
    app.post('/jwt', (req, res) =>{
      const user = req.body;


      const token = jwt.sign(
        user, process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      })
      .send({ success: true });
    })

    //logout

    app.post('/logout', (req, res) =>{
      res
      .clearCookie('token')
      .send({success: true});
    })

    //user related api
    app.post('/users', async(req, res)=>{
        const newUser = req.body;

        const exist = await usersCollection.findOne({
            email: newUser.email,
        });

        if(exist){
            return res.send({
                inserted: false,
                message: "user already exist",
            })
        }
        
        const result = await usersCollection.insertOne(newUser)
        res.send(result);
    })

    //get user

   app.get('/users/:email', verifyToken, async (req, res) => {
  const email = req.params.email;

   if (email !== req.user.email) {
    return res.status(403).send({ message: "Forbidden Access" });
  }

  const result = await usersCollection.findOne({
    email: email,
  });

  res.send(result);
});

    //Assignment related apis

    app.post('/assignment', verifyToken, async(req, res) =>{
      const assignmentData = req.body;
      const result = await assignmentCollection.insertOne(assignmentData);
      res.send(result);
    });

    //get assignments from db
    app.get('/assignments', async(req, res) =>{
      const result = await assignmentCollection.find().toArray();
      res.send(result);
    })

    // get assignment by id
    app.get('/assignments/:id', async(req, res) =>{
      const id = req.params.id;

      const query = {_id: new ObjectId(id)};
      const result = await assignmentCollection.findOne(query);
      res.send(result);
    })

    // submitted assignment related apis

    app.post('/submittedAssignments', async(req, res) =>{
      const submittedData = req.body;
      const result = await submittedAssignmentCollection.insertOne(submittedData);
      res.send(result);
    })


    //check if the assignment submitted or not
    app.get('/submittedAssignments/check', async(req, res) =>{
      const {assignmentId, email} = req.query;

      const query = {
        assignmentId,
        examineeEmail: email,
      }
      const result = await submittedAssignmentCollection.findOne(query);
      res.send(result);
    })

    //get pending assignments

    app.get('/submittedAssignments', async(req, res) =>{
      const result = await submittedAssignmentCollection.find(
        {status: "pending"}).toArray();

        res.send(result);
    })

    //update assignment
    app.put('/assignment/:id', verifyToken, async(req, res) =>{
      const id = req.params.id;
      const updatedAssignment = req.body;

      const result = await assignmentCollection.updateOne(
        {_id : new ObjectId(id)},
        {
          $set: {
            title: updatedAssignment.title,
            thumbnail: updatedAssignment.thumbnail,
            marks: updatedAssignment.marks,
            difficulty: updatedAssignment.difficulty,
            dueDate: updatedAssignment.dueDate,
            description: updatedAssignment.description,
          },
        }
      );

      res.send(result);
    })

    //update assignment while given marks

  app.patch('/submittedAssignments/:id', verifyToken, async(req, res) =>{
    const {id} = req.params;

    const result = await submittedAssignmentCollection.updateOne(
      {_id: new ObjectId(id)},
       {
    $set: {
      obtainedMarks: Number(req.body.obtainedMarks),
      feedback: req.body.feedback,
      status: req.body.status,
      examiner: req.body.examiner,
      docs: req.body.docs,
      note: req.body.note,
    },
  },
  {
    upsert: true,
  }
    );
    
    res.send(result);
  })

  //delete assignment
  app.delete('/assignment/:id', verifyToken, async(req, res) =>{
    const id = req.params.id;

    const result = await assignmentCollection.deleteOne(
      {_id : new ObjectId(id)}
    );

    res.send(result);
  })

  // getting my attempts

   app.get('/myAttempts/:email', verifyToken, async(req, res) =>{

    const email = req.params.email;

      if (email !== req.user.email) {
    return res.status(403).send({
      message: "Forbidden Access",
    });
  }


      const result = await submittedAssignmentCollection.find(
        {examineeEmail: email}).toArray();

        res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Study-Connect app listening on port ${port}`)
})