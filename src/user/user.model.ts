import dynamoose from "dynamoose"
import type { Model } from "dynamoose/dist/Model/index.js"
import type { Schema } from "dynamoose/dist/Schema.js"
import type { User } from "./user.type.js"

const userSchema:Schema = new dynamoose.Schema({
    name:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:[String],
        required:true
    }
},{
    timestamps:true
})

const UserModel = dynamoose.model('UserModel',userSchema) ;

export default UserModel