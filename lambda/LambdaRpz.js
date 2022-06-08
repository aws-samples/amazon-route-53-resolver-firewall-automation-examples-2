// Package
const axios = require('axios');
const aws = require('aws-sdk');

// Const 
const dataSource = "https://urlhaus.abuse.ch/downloads/rpz/"
const testEntry = "testentry.rpz.urlhaus.abuse.ch"
const s3Prefix = "s3://" + process.env.s3Prefix + "/"
const firewallDomainListId = process.env.FirewallDomainListId
const region = process.env.Region

// AWS Object
const s3 = new aws.S3({ "region": region });
const route53Resolver = new aws.Route53Resolver({ "region": region });

function checkForTotalEntry(domainList, totalEntry) {
  if (domainList.length != totalEntry) {
    throw new Error("Unable to fully parse the data from urlhaus expected : " + totalEntry + " got : " + domainList.length)
  }
}

function parser(data) {
  let parsedList = data.split('\n')
  let headerFlag = false
  let domainList = []
  let totalEntry = parseInt(parsedList[parsedList.length - 1].split(':')[1])

  parsedList.forEach(element => {
    var url = element.split(" ")[0]
    if (headerFlag && url != ";") {
      domainList.push(url)
    }
    headerFlag |= (url == testEntry)
  });

  console.log("[INFO] List of domains correctly fetched, " + totalEntry.toString() + " entries have been fetched")
  return { domain_list: domainList, total_entry: totalEntry }
}

async function uploadToS3(domainList, filekey) {
  let s3Params = {
    Bucket: process.env.s3Prefix,
    Key: filekey,
    Body: domainList.join('\n'),
    ContentType: "text/plain"
  }
  await s3.putObject(s3Params).promise()
  console.log("[INFO] File : " + filekey + " uploaded to s3")
}

async function updateRoute53DomainList(filekey) {
  let route53ResolverParams = {
    DomainFileUrl: s3Prefix + filekey,
    FirewallDomainListId: firewallDomainListId,
    Operation: "REPLACE"
  }
  await route53Resolver.importFirewallDomains(route53ResolverParams).promise()
  console.log("[INFO] DNS Firewall of id : " + firewallDomainListId + " updated with file " + filekey)
}

async function fetchData() {
  let { domain_list, total_entry } = await axios.get(dataSource)
    .then(res => {
      return parser(res.data)
    })
    .catch(error => {
      throw new Error("Error when fetching data from : " + dataSource + " got : " + error)
    })

  checkForTotalEntry(domain_list, total_entry)
  return domain_list
}

async function payload() {
  let filekey = Math.floor(new Date() / 1000) + "-urlhause-domain-list.txt"
  let domainList = await fetchData()
  await uploadToS3(domainList, filekey)
  await updateRoute53DomainList(filekey)
}

exports.handler = async (event) => {
  await payload()
};