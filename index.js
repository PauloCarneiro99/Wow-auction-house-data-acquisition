const axios = require('axios')
const fs = require('fs')
const moment = require('moment')
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


const main = async () => {
    const realmList = await getRealmsInfo()
    const filename = `${realmName}_${moment().format('YYYY_MM_DD_H')}`
    const realmName = 'Proudmoore'
    const realmId = findRealmId(realmList, realmName)

    console.log(`Realm id ${realmId}`)
    const auctionHouseData = await getAuctionHouse(realmId)
    fs.writeFileSync(`${filename}.json`, JSON.stringify(auctionHouseData))
}

main()