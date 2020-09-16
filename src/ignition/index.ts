import Auth from '../helpers/index'
import axios from 'axios'
import { Lambda, config } from 'aws-sdk'

config.update({ region: 'us-east-1' })
const lambda = new Lambda()
const auth = new Auth()

const delay = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getRealmsInfo = async () => {
    const token = await auth.getToken()
    var getUrl = `https://us.api.blizzard.com/data/wow/realm/index?namespace=dynamic-us&locale=en_US&access_token=${token}`
    const response = await axios.get(getUrl)
    return response.data.realms.map(element => element.name)
}

export default async (event, context, callback) => {
    const stage = process.env.stage
    const realmNameList = await getRealmsInfo()
    for (let realmName of realmNameList) {
        try {
            console.log('Start data acquisition for Realm=', realmName)
            await lambda.invoke(
                {
                    Payload: JSON.stringify({ realmName: realmName }),
                    FunctionName: `wow-project-${stage}-acquisition`,
                    Qualifier: "1"
                }
            ).promise()
        } catch (e) {
            console.error(e)
        }
        await delay(300)
    }
}