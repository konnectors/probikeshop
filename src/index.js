const {
  BaseKonnector,
  requestFactory,
  signin,
  scrape,
  saveBills,
  log
} = require('cozy-konnector-libs')
const stream = require('stream')
//const $ = require('cheerio')
const request = requestFactory({
  // the debug mode shows all the details about http request and responses. Very usefull for
  // debugging but very verbose. That is why it is commented out by default
  //debug: true,
  // activates [cheerio](https://cheerio.js.org/) parsing on each page
  cheerio: true,
  // If cheerio is activated do not forget to deactivate json parsing (which is activated by
  // default in cozy-konnector-libs
  json: false,
  // this allows request-promise to keep cookies between requests
  jar: true
})
const cheerio = require('cheerio')
const baseUrl = 'https://www.probikeshop.fr'

const fields = require('../konnector-dev-config.json')

request(`${baseUrl}/mon-compte`, {
  xmlMode: true
})
  .then($ => $)
  .catch(error => {
    //console.log('error', error)

    const notCleanedHtml = error.message
      .substr(6, error.message.length)
      .replace(/&quot;/g, '')
      .replace(/\\/g, '')
    const newPage = cheerio.load(notCleanedHtml)
    const [action, inputs] = formContent(newPage, 'form[action="/login.html"]')
    inputs["signin[email]"] = fields.fields.login
    inputs["signin[password]"] = fields.fields.password
    
    post(`${baseUrl}${action}`, inputs)
      .then($ => {
        //console.log('success ? ', $.html())
        request(`${baseUrl}/mon-compte/commandes/`).then($ => {
          //console.log($.html())
          const parseEntries = []
          $('.orders_table tr').each(function() {
           /*  const toto = $(this).children();
            console.log({toto}) */
          //  const test = $(this).attr('href');
            const row = Array.from($(this).children('td')).map(cell => getText($(cell)));
            const fileUrl =  $(this).find('a').attr('href');
            /* const tds = toto('td');
            console.log({tds})
            tds.each(function()  {
              console.log('totot', $(this).html())
            }) */
            //console.log('test', tds[0])
            //console.log('re',toto('td'));
            //console.log('test', test)
           // console.log(test('a').html())
            //console.log($(this).html())
            if(fileUrl !== undefined){
              parseEntries.push(parseEntriesFor(fileUrl, row));
            }
            
          })
          return Promise.all(parseEntries).then(entriers => {
            console.log({entriers})
            return [].concat.apply([], entriers)
          })
          .then(entries => {
            return saveBills(
              entries,
              {folderPath: './'},
              {identifiers: ['generali'], keys: ['date', 'amount', 'vendor'], contentType: 'application/html'}
            )
        })
        })
      })
      .catch(error => {
        console.log('*******', error)
      })
  })
  .finally((...args) => {
    console.log('finally?', args)
  })
  const getText = function ($cell) {
    return $cell.text().trim()
  }
 function parseDate (text) {
    return new Date(...text.split('/').reverse())
  }
function parseEntriesFor(fileUrl, row){
  if(fileUrl !== undefined){
    console.log('fileUrl', fileUrl)
  const common = {
    vendor: 'Probikeshop',
    type: 'loisirs',
    isRefund: true,
    beneficiary: 'beneficiary',
    isThirdPartyPayer: true
  }
   /* const pdfStream = new stream.PassThrough()
  rq = requestFactory({cheerio: false, json: false}) */
   // common.filestream = rq(`${baseUrl}${fileUrl}`).pipe(pdfStream)
   // console.log({pdfStream})
    common.date = parseDate(row[1])
    common.filename = `${common.date}_${Math.random()}_probikeshop.pdf`
    common.fileurl = `${baseUrl}${fileUrl}`
  common.isThirdPartyPayer = false;
  
  common.amount = parseFloat(row[2].replace(',','.').replace(' €', ''));
  return request(`${baseUrl}${fileUrl}`).then($ => {
   // console.log('toto', $.html())
    return common;
  }) 
}
  
  
}
function formContent($, selector) {
  const action = $(selector).attr('action')
  const inputs = {}
  $(`${selector} input`).each(function() {
    inputs[$(this).attr('name')] = $(this).attr('value')
  })
  return [action, inputs]
}
function post(uri, inputs) {
  console.log({inputs})
  return request({
    uri: uri,
    method: 'POST',
    form: {
      ...inputs
    }
  })
}
/*
module.exports = new BaseKonnector(start)

// The start function is run by the BaseKonnector instance only when it got all the account
// information (fields). When you run this connector yourself in "standalone" mode or "dev" mode,
// the account information come from ./konnector-dev-config.json file
async function start(fields) {
  log('info', 'Authenticating ...')
  //await authenticate(fields.login, fields.password)
  try {
    const $ = await request(`${baseUrl}/mon-compte/`)
  } catch (e) {
    console.log('rrrrorr', e)
    //console.log('toto', $('form[action="/login.html"]').html())
    const test = cheerio.load(e)
    console.log({ test })
    test('form[action="/login.html"]').html()
  }

  /*  log('info', 'Successfully logged in')
  // The BaseKonnector instance expects a Promise as return of the function
  log('info', 'Fetching the list of documents')
  const $ = await request(`${baseUrl}/index.html`)
  // cheerio (https://cheerio.js.org/) uses the same api as jQuery (http://jquery.com/)
  log('info', 'Parsing list of documents')
  const documents = await parseDocuments($)

  // here we use the saveBills function even if what we fetch are not bills, but this is the most
  // common case in connectors
  log('info', 'Saving data to Cozy')
  await saveBills(documents, fields.folderPath, {
    // this is a bank identifier which will be used to link bills to bank operations. These
    // identifiers should be at least a word found in the title of a bank operation related to this
    // bill. It is not case sensitive.
    identifiers: ['books'] 
  })*/
/* const toto = $('form[action="/login.html"]')
  console.log({ toto })
  console.log(toto.html())
   */
