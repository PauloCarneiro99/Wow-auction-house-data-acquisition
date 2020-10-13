import Auth from '../helpers/index'
import axios from 'axios'
import { readFile } from 'fs'
import * as groupBy from 'group-by'

// const groupBy = require('group-by');

const auth = new Auth()
const deals = []

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getItemInfo = async (itemId: string) => {
    try {
        const token = await auth.getToken()
        var getUrl = `https://us.api.blizzard.com/data/wow/item/${itemId}?namespace=static-us&locale=en_US&access_token=${token}`
        const response = await axios.get(getUrl)
        const { sell_price, name } = response.data
        return { sell_price, name }
    } catch (e) {
        console.error(e)
    }
}

const processAuction = async ({ value, quantity, id }) => {
    const { sell_price, name } = await getItemInfo(id)
    console.log(name)
    if (sell_price && parseInt(sell_price) > parseInt(value)) {
        deals.push({
            name,
            quantity,
            profit: (value - sell_price) * quantity,
            sell_price,
            value
        })
    }
}

const groupUp = async (data) => {
    const formattedData = data.map(r => {
        return { quantity: r.quantity, id: r.item.id, value: r.buyout || r.unit_price }
    })
    const grouped_data = groupBy(formattedData, 'id')
    const results = []
    for (let key of Object.keys(grouped_data)) {
        results.push(grouped_data[key].sort((a, b) => (a.value > b.value) ? 1 : -1)[0])
    }
    return results
}

export default async (event, context, callback) => {
    //trocar pelo evento esperado pelo s3
    if (process.env.stage === 'local') {
        await readFile('src/anomaly/test.json', 'utf8',
            async function (err, data) {
                if (err) {
                    return console.error(err);
                }
                const groupedData = await groupUp(JSON.parse(data))
                for (let record of groupedData) {
                    try {
                        if (!record.value) continue
                        await processAuction(record)
                        await sleep(100);
                    } catch (e) {
                        console.log(e)
                        break
                    }
                }
            }
        )
    } else {
        throw new Error('Not implemented yet')
    }

    deals.sort((a, b) => (a.profit > b.profit) ? -1 : 1)
    console.log('Deals are ', deals)
}

