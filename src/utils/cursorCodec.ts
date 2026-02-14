
class CursorCodec {

  static encode(data:unknown) : string {
    try {
      const encodedCursor : string= Buffer.from(JSON.stringify(data),'utf-8').toString('base64')
      
      return encodedCursor
      
    } catch {
      throw Object.assign(new Error(`Failed to encode the object`),{statusCode:400})
    }
  }

  static decode(cursor: string) {
    try {
      const decodedCursor = Buffer
        .from(cursor, "base64")
        .toString("utf-8");

      return JSON.parse(decodedCursor);
      
    } catch {
        throw Object.assign(new Error(`Failed to decode the object`),{statusCode:400})
    }
  }

}



export default CursorCodec