import Auth from '../helpers/index'
import axios from 'axios'
import { readFile } from 'fs'
import * as groupBy from 'group-by'
import * as nodemailer from 'nodemailer'
import { S3 } from 'aws-sdk'

require("dotenv").config()

const auth = new Auth()
const deals = []


var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_SENDER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const sendEmail = (subject, text) => {
    var mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: process.env.EMAIL_RECEIVER,
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}


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
        const s3 = new S3()
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
        try {
            const params = {
                Bucket: bucket,
                Key: key
            };
            const data = await s3.getObject(params).promise()
            const fileContent = JSON.parse(String(data.Body))
            const groupedData = await groupUp(fileContent)
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
        } catch (error) {
            console.error(error);
            return;
        }
    }


    deals.sort((a, b) => (a.profit > b.profit) ? -1 : 1)
    console.log('Deals are ', deals)
    if (deals.length > 0) sendEmail('Great deals at World of Warcraft', JSON.stringify(deals))
    else console.log('No deals today')
}

