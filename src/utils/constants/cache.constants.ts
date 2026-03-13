export const CACHE_KEYS = {
  MAIN_FOLDERS : "MainFolders",   
  SUB_FOLDERS  : (parentId: string | null) => `SubFolders:${parentId}`,
  FOLDER : (folderId:string | null) => `Folder:${folderId}`
} as const;

export const OBJECT_CACHE = {
  PUT_OBJECT_PRESIGNED_URL : (objectId : string ) => `put_presigned_url:${objectId}` ,
  GET_OBJECT_PRESIGNED_URL : (objectId : string ) => `get_presigned_url:${objectId}` ,
  OBJECT_TTL : 600 , 
  PRESIGNED_URL_TTL : 1020
}