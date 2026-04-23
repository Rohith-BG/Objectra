import type { ParsedQs } from "qs";

export interface Object {
    id?: string,
    name: string,
    key: string,
    folderId: string,
    status: string,
    createdAt?: string,
    updatedAt?: string
}

export enum UploadStatus {
    pending = "PENDING",
    uploaded = "UPLOADED"
}

export type ObjectName = string

export type ObjectId = string

export interface ObjectIdQueryParam extends ParsedQs {
    id: string
}

export interface ObjectRequestBody {
    name: string
}

export interface FolderIdCursorQueryParam extends ParsedQs {
    id: string,
    cursor?: string
}

export interface ObjectIdParam {
    id: ObjectId
}

export type PresignedURL = string