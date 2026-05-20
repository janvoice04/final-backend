const bodyParser = require("body-parser")
const express=require("express")
const cors=require("cors")
const app=express()
require("dotenv").config()
const jwt=require("jsonwebtoken")
const connectDB=require("./db")
const userModel=require("./models/usersmodel")
const reportModel=require("./models/reportsmodel")
const OtpModel=require("./models/otpmodel")
const multer = require('multer')
const nodemailer=require("nodemailer")
const secret_key=process.env.JWT_SECRET
app.use(express.static(__dirname+"/public"))
app.use(
  "/uploads",
  express.static("uploads")
);
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(cors())
    const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  
});
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
})
const upload = multer({ storage })


connectDB()

app.post("/register", (req, res) => {
    const new_user = new userModel({
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        phoneno: req.body.phoneno,
        role: req.body.role
    })

    new_user.save().then(() => {
        res.json({ success: true })
    })
})
app.post("/login", async (req, res) => {
  const { username, password ,role} = req.body;
    console.log(username,password)
  const user = await userModel.findOne({ username ,password,role});
  console.log(user);
  if(user==null) {return res.json({ success: false, msg: "Invalid credentials" });}
  else{
      const Otp = Math.floor(100000 + Math.random() * 900000).toString();
      await OtpModel.deleteMany({ userId: user._id });
      var otp=new OtpModel({
        userId:user._id,
        otp:Otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      })

     await otp.save();
 
    await transporter.sendMail({
      from: "bijinepallijoshitha@gmail.com",
      to: user.email,
      subject: "OTP Verification",
      text: `Your OTP is ${Otp}`,
    });
     res.json({
      status:true,
      userId: user._id,
    });


  }
});
app.post("/resend-otp", async (req, res) => {

  try {

    const { userId } = req.body;

    // Find user
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    // Delete old OTP
    await OtpModel.deleteMany({ userId });

    // Generate new OTP
    const newOtp =
      Math.floor(100000 + Math.random() * 900000).toString();

    // Save new OTP
    const otpData = new OtpModel({
      userId,
      otp: newOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await otpData.save();

    // Send Mail
    await transporter.sendMail({

      from: "bijinepallijoshitha@gmail.com",

      to: user.email,

      subject: "Resend OTP Verification",

      text: `Your new OTP is ${newOtp}`,

    });

    res.json({
      success: true,
      msg: "OTP resent successfully",
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      msg: "Server Error",
    });
  }
});
app.post("/verify-otp", async (req, res) => {

  const { userId, otp } = req.body;
  console.log(userId, otp);
  const user = await userModel.findById(userId);

  const otpData = await OtpModel.findOne({ userId });

  if (!otpData) {
    return res.status(404).json({
      message: "OTP not found",
    });
  }

  // Expiry check
  if (new Date() > otpData.expiresAt) {
    return res.status(400).json({
      message: "OTP expired",
    });
  }

  // OTP check
  if (otpData.otp !== otp) {
    return res.status(400).json({
      message: "Invalid OTP",
    });
  }

  // Create JWT after OTP verification
  const token = jwt.sign(
    {userId, role: user.role },
    secret_key,
    { expiresIn: "1d" }
  );

  // Delete OTP
  await OtpModel.deleteOne({ _id: otpData._id });

  res.status(200).json({
    status: true,
    token,
    userId,
    role: user.role,
    username: user.username,

  });
});
const verifyToken = (req, res, next) => {
    console.log("middleware");
  const auth = req.headers.authorization;

  if (!auth) return res.status(401).json({ msg: "No token" });

  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token,secret_key);
    req.user = decoded._id;
    req.role = decoded.role;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Invalid token" });
  }
};
app.use(verifyToken)

app.listen(process.env.PORT||3600,()=>{
    console.log("hi server listening to "+process.env.PORT);
})
app.post("/addIssue", upload.single("issue_image"), (req, res) => {
    const new_report = new reportModel({
        issue_name: req.body.issue_name,
        issue_description: req.body.issue_description,
        issue_image: req.file.filename,
        issue_address: req.body.issue_address,
        userId: req.body.userId
    })
    new_report.save().then(() => {
        res.json({ msg: "success" })
    })
})
app.get("/getmyIssues/:id", (req, res) => {
    reportModel.find({ userId: req.params.id })
        .then((data) => {
            res.json(data)
        })
})
app.post("/exploreIssue",(req,res)=>{
   userModel.find({_id:req.body.userId})
   .then((data)=>{
    res.json(data)
   })
})
app.post("/updateIssue", async (req, res) => {

  try {

    const report =
      await reportModel.findById(
        req.body.id
      );

    if (!report) {
      return res.json({
        msg: "Issue not found",
      });
    }

    // Find complaint owner
    const user =
      await userModel.findById(
        report.userId
      );

    let updatedStatus = "";

    // Pending → Assigned
    if (
      report.issue_status === "Pending"
    ) {

      updatedStatus = "Assigned";

      await reportModel.updateOne(
        { _id: req.body.id },
        {
          $set: {
            issue_status:
              updatedStatus
          }
        }
      );

      // Send Mail
      await transporter.sendMail({

        from:
          "bijinepallijoshitha@gmail.com",

        to: user.email,

        subject:
          "Issue Status Updated",

        text:
          `Your issue "${report.issue_name}" has been updated to Assigned.`,
      });

      return res.json({
        msg: "Issue Assigned",
      });
    }

    // Assigned → Resolved
    else if (
      report.issue_status === "Assigned"
    ) {

      updatedStatus = "Resolved";

      await reportModel.updateOne(
        { _id: req.body.id },
        {
          $set: {
            issue_status:
              updatedStatus
          }
        }
      );

      // Send Mail
      await transporter.sendMail({

        from:
          "bijinepallijoshitha@gmail.com",

        to: user.email,

        subject:
          "Issue Status Updated",

        text:
          `Your issue "${report.issue_name}" has been resolved.`,
      });

      return res.json({
        msg: "Issue Resolved",
      });
    }

    else {

      return res.json({
        msg:
          "Issue already resolved",
      });
    }

  } catch (err) {

    console.log(err);

    res.status(500).json({
      msg: "Server Error",
    });
  }
});

app.post("/deleteIssue",(req,res)=>{
    reportModel.findByIdAndDelete(req.body.id)
    .then((data)=>{
        res.json({msg:"issue deleted",data})
    })
})

app.post("/getIssuesByStatus",(req,res)=>{
    if(req.body.issue_status==="all"){
        reportModel.find()
        .then((data)=>{
            res.json(data)
        })
    }
    else{
        reportModel.find({issue_status:req.body.issue_status})
        .then((data)=>{
            res.json(data)
        })
    }
})
app.post(
  "/getProfile",
  async (req, res) => {

    try {

      const user =
        await userModel.findById(
          req.body.userId
        );

      if (!user) {

        return res.json({
          success: false,
          msg: "User not found",
        });
      }

      res.json({
        success: true,
        user,
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        success: false,
        msg: "Server Error",
      });
    }
});
app.post(
  "/editProfile",
  async (req, res) => {

    try {

      const {
        userId,
        username,
        email,
        phoneno,
      } = req.body;

      await userModel.findByIdAndUpdate(

        userId,

        {
          username,
          email,
          phoneno,
        }

      );

      res.json({
        success: true,
        msg: "Profile Updated",
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        success: false,
        msg: "Server Error",
      });
    }
});

app.post("/getmyIssuesByStatus",(req,res)=>{
    if(req.body.issue_status==="all"){
        reportModel.find({userId:req.body.userId})
        .then((data)=>{
            res.json(data)
        })
    }
    else{
        reportModel.find({issue_status:req.body.issue_status, userId:req.body.userId})
        .then((data)=>{
            res.json(data)
        })
    }
})
app.get("/getAllIssues", (req, res) => {
    reportModel.find()
    .then((data) => {
        res.json({
            success: true,
            issues: data
        })
    })
    .catch((err) => {
        res.status(500).json({
            success: false,
            msg: "Server error",
            error: err.message
        })
    })
})
app.get("/getAllUsers", (req, res) => {
    userModel.find()
    .then((data) => {
        res.json({
            success: true,
            users: data
        })
    })
    .catch((err) => {
        res.status(500).json({
            success: false,
            msg: "Server error",
            error: err.message
        })
    })
})
app.post(
  "/supportIssue",
  async (req, res) => {

    const {
      issueId,
      userId
    } = req.body;

    try {

      const issue =
        await reportModel.findById(
          issueId
        );

      if (!issue) {

        return res.json({
          msg:
            "Issue not found"
        });
      }

      // Prevent duplicate support
      if (
        issue.affectedUsers.includes(
          userId
        )
      ) {

        return res.json({
          msg:
            "Already supported"
        });
      }

      // Add user
      issue.affectedUsers.push(
        userId
      );

      await issue.save();

      res.json({
        msg:
          "Issue supported",
        affectedCount:
          issue.affectedUsers.length
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        msg:
          "Server Error"
      });
    }
});
