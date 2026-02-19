export interface Folder{
    id:string,
    name:string,
    parentId: string | null ,
    createdAt?:string,
    updatedAt?:string
}

export interface FolderIdQueryParam {
    id: string;
}

export interface FolderNameRequestBody{
    name:FolderName
}

export interface CursorQueryParam {
    cursor : string
}

export interface ParentIdQueryParam{
    parentId : string
}

export interface FolderIdParam{
    id:string
}

export interface UpdateParentIdRequestBody{
    currentParentId : FolderId,
    newParentId : FolderId
}

export type Cursor = string | undefined

export type FolderName = string 

export type FolderId = string

export type ParentId = string | null
 
