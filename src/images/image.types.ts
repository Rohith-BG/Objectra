export interface Image{
    id?:string,
    name:string,
    objectKey:string,
    folderId:string,
    status:string,
    createdAt?:string,
    updatedAt?:string
}

export enum UploadStatus  {
    pending = "PENDING",
    uploaded = "UPLOADED"
}

export type ImageName=string

export type ImageId = string

export interface ImageIdQueryParam {
    id:string
}

export interface ImageRequestBody  {
    name:string
}

export interface FolderIdCursorQueryParam {
    id : string,
    cursor?: string
}

export type PresignedURL = string