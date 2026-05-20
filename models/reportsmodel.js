const mongoose=require("mongoose")
const reportschema = mongoose.Schema({
    issue_name: String,
    issue_description: String,
    issue_image: String,
    issue_status: {
        type: String,
        default: "Pending"
    },
    issue_date: {
        type: Date,
        default: Date.now
    },
    issue_address: String,
    userId: String,
    affectedUsers: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users"
  }
]
})

const reportModel = mongoose.model(
  "janVoice_reports",  
  reportschema,
  "janVoice_reports"  
);
module.exports=reportModel