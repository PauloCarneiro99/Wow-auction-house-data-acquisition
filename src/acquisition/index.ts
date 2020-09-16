import { S3, config } from 'aws-sdk'
import * as moment from 'moment'
import axios from 'axios'
import Auth from '../helpers/index'
import { writeFile } from 'fs'

require("dotenv").config()


config.update({ region: 'us-east-1' })
const s3 = new S3()
const auth = new Auth()

const getRealmsInfo = async () => {
    const token = await auth.getToken()
    var getUrl = `https://us.api.blizzard.com/data/wow/realm/index?namespace=dynamic-us&locale=en_US&access_token=${token}`
    const response = await axios.get(getUrl)
    return response.data.realms
}

const findRealmId = (realmList, realmName) => {
    try {
        const { id } = realmList.filter((value) => {
            return value.name == realmName
        })[0]
        return id
    } catch (e) {
        throw new Error(e)
    }
}

const getAuctionHouse = async (realmId) => {
    const token = await auth.getToken()
    var getUrl = `https://us.api.blizzard.com/data/wow/connected-realm/${realmId}/auctions?namespace=dynamic-us&locale=en_US&access_token=${token}`
    const response = await axios.get(getUrl)
    return response.data.auctions
}


export default async (event, context, callback) => {
    const realmList = await getRealmsInfo()
    const realmName = event.realmName || 'Proudmoore'
    const filename = `${realmName}/${moment().format('YYYY_MM_DD_H')}.json`
    const realmId = findRealmId(realmList, realmName)

    console.log(`Realm id ${realmId}`)
    const auctionHouseData = await getAuctionHouse(realmId)

    if (auctionHouseData) {
        console.log(`Uploading ${auctionHouseData.length} records to s3`)
        if (process.env.stage != 'local') {
            await s3.upload(
                {
                    Bucket: `data-acquisition-${process.env.stage}`,
                    Key: filename,
                    Body: JSON.stringify(auctionHouseData)
                }
            ).promise()
        } else {
            writeFile('test.json', JSON.stringify(auctionHouseData), function (err) { })
        }
    } else {
        console.log('Failed to fetch data from this realm')
    }

    callback(null)
}