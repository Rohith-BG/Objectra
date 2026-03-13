
class RandomIdGenerator{

    static getId():string{
        return crypto.randomUUID()
    }
}

export default RandomIdGenerator



