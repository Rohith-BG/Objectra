import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export interface Folder{
    id:string,
    name:string,
    parentId: string | null ,
    createdAt?:string,
    updatedAt?:string
}

export interface FolderIdQueryParam extends ParsedQs {
    id: string;
}

export interface FolderNameRequestBody{
    name:FolderName
}

export interface CursorQueryParam {
    cursor : string
}

export interface ParentIdQueryParam extends ParsedQs{
    parentId : string
}

export interface FolderIdParam extends ParamsDictionary{
    id:string
}

export interface UpdateParentIdRequestBody{
    parentId : FolderId
    oldParentId : FolderId
}

export type Cursor = string | undefined

export type FolderName = string 

export type FolderId = string

export type ParentId = string | null
 
