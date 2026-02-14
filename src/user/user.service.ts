import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js";
import UserModel from "./user.model.js"
import type {User} from "./user.type.js"

export async function createUser(name:String,password:String,role:String[]){
    try{
        const user  = await UserModel.create({name,password,role});

        if(!user){
            throw new BAD_REQUEST_ERROR(`Failed to create a user`)
        }
        return user
    }
    catch(err){
        throw err
    }
}

