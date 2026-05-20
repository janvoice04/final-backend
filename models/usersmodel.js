const mongoose=require("mongoose")
const userSchema = mongoose.Schema({
    username: String,
    password: String,
    email: String,
    phoneno: String,
    role: String,
    date: {
        type: Date,
        default: Date.now
    }
})
const userModel = mongoose.model(
  "janVoice_users",
  userSchema,
  "janVoice_users"
)

module.exports=userModel