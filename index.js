const axios = require('axios')
const moment = require('moment')
const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' })
const s3 = new AWS.S3()
require("dotenv").config()

const credentials = {
    client: {
        id: process.env.BNET_ID,
        secret: process.env.BNET_SECRET
    },
    auth: {
        tokenHost: "https://us.battle.net"
    }
}

const oauth2 = require("simple-oauth2").create(credentials)

const getToken = () => {
    return oauth2.clientCredentials
        .getToken()
        .then(oauth2.accessToken.create)
        .then(t => {
            return t.token.access_token;
        })
}

const getRealmsInfo = async () => {
    const token = await getToken()
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
    const token = await getToken()
    var getUrl = `https://us.api.blizzard.com/data/wow/connected-realm/${realmId}/auctions?namespace=dynamic-us&locale=en_US&access_token=${token}`
    const response = await axios.get(getUrl)
    return response.data.auctions
}


module.exports.handler = async (event, context, callback) => {
    const realmList = await getRealmsInfo()
    const realmName = event.realmName || 'Proudmoore'
    const filename = `${realmName}/${moment().format('YYYY_MM_DD_H')}.json`
    const realmId = findRealmId(realmList, realmName)

    console.log(`Realm id ${realmId}`)
    const auctionHouseData = await getAuctionHouse(realmId)

    if (auctionHouseData) {
        console.log(`Uploading ${auctionHouseData.length} records to s3`)
        await s3.upload(
            {
                Bucket: `data-acquisition-${process.env.stage}`,
                Key: filename,
                Body: JSON.stringify(auctionHouseData)
            }
        ).promise()
    } else {
        console.log('Failed to fetch data from this realm')
    }

    callback(null)
}