process.env.SENTRY_DSN =
  process.env.SENTRY_DSN ||
  'https://c360ae2d69a64b58b0f5fed3b8c5ce4e@sentry.cozycloud.cc/92'

const {
  requestFactory,
  saveBills,
  BaseKonnector
} = require('cozy-konnector-libs')

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

module.exports = new BaseKonnector(start)

async function start(fields) {
  try {
    await request(`${baseUrl}/mon-compte`, {
      xmlMode: true
    })
  } catch (error) {
    const notCleanedHtml = error.message
      .substr(6, error.message.length)
      .replace(/&quot;/g, '')
      .replace(/\\/g, '')
    const newPage = cheerio.load(notCleanedHtml)
    const [action, inputs] = formContent(newPage, 'form[action="/login.html"]')
    inputs['signin[email]'] = fields.login
    inputs['signin[password]'] = fields.password

    await post(`${baseUrl}${action}`, inputs)

    const $ = await request(`${baseUrl}/mon-compte/commandes/`)

    const parseEntries = []
    $('.orders_table tr').each(function() {
      const row = Array.from($(this).children('td')).map((cell, index) =>
        getText($(cell), index)
      )
      if (row[5] !== undefined) {
        parseEntries.push(parseEntriesFor(row[5], row))
      }
    })
    const entriers = await Promise.all(parseEntries)
    const entries = [].concat.apply([], entriers)

    return saveBills(entries, fields, {
      identifiers: ['probikeshop'],
      keys: ['id'],
      contentType: 'application/pdf'
    })
  }
}

const getText = function($cell, index) {
  if (index !== 5) {
    return $cell.text().trim()
  } else {
    return $cell.find('a').attr('href')
  }
}
const months = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre'
]

function parseDate(text) {
  const [day, month, year] = text.split(' ')
  return new Date(year, months.indexOf(month), day)
}

function formatDate(date) {
  let year = date.getFullYear()
  let month = date.getMonth() + 1
  let day = date.getDate()
  if (month < 10) {
    month = '0' + month
  }
  if (day < 10) {
    day = '0' + day
  }
  return `${year}-${month}-${day}`
}

function parseEntriesFor(fileUrl, row) {
  if (fileUrl !== undefined) {
    const common = {
      vendor: 'probikeshop',
      currency: '€'
    }
    common.id = row[0]
    common.date = parseDate(row[1])
    common.amount = parseFloat(row[2].replace(',', '.').replace(' €', ''))
    common.filename =
      `${formatDate(common.date)}` +
      `_${common.amount}€` +
      `_${common.id}` +
      `_probikeshop.pdf`
    common.fileurl = `${baseUrl}${fileUrl}`
    return request(`${baseUrl}${fileUrl}`).then(() => {
      return common
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
  return request({
    uri: uri,
    method: 'POST',
    form: {
      ...inputs
    }
  })
}
