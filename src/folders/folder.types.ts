export interface Folder{
    id:string,
    name:string,
    createdAt?:string,
    updatedAt?:string
}

export interface FolderIdQueryParam {
    id: string;
}

export interface FolderRequestBody{
    name:FolderName
}

export interface CursorQueryParam {
    cursor : string
}

export type Cursor = string | undefined

export type FolderName = string 

export type FolderId = string

