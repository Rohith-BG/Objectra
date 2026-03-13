import { SFNClient } from "@aws-sdk/client-sfn";

const StepFunctionClient = new SFNClient({
    region : process.env.AWS_REGION!
})


export default StepFunctionClient