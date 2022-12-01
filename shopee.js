const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const config = require('./config.json').shopee;
const uaTool = require("useragent-tool");
const commander = require('commander');
const program = new commander.Command();

program
  .requiredOption('-q, --search <string>', 'search query')
  .parse()

// created at november 2022

//for counting your process
let timer = 0;

const scraper = (async () => {
  let startTime = performance.now();

  console.log('processing ............ !!!!')
  if (program.opts().search === undefined || program.opts().search === '') {
    throw new Error('NO_KEYWORD');
  }

  const url = `https://www.shopee.co.id/search?keyword=${program.opts().search.split(' ').join('%20')}`;
  console.log(url);
  let randomUserAgent = '';
  let products = []

  const browser = await puppeteer.launch({
    args: [
      "--disable-web-security",
      '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  do{
    randomUserAgent = uaTool.getRandomUserAgent();
    console.log("this User agent :", randomUserAgent);
    const context = await browser.createIncognitoBrowserContext(); //incognito
    const page = await context.newPage();
    await page.setJavaScriptEnabled(true); //enable js

    //setting user agent
    await page.setUserAgent(randomUserAgent);
    await page.goto(url, { waituntil: 'domcontentloaded', timeout: 0 }); //tunggu proses dom/load pagenya selesai

    await autoScroll(page);

    console.log("get body");
    const body = await page.evaluate(() => {
      return document.querySelector('body').innerHTML;
    }); //get all body

    products = await getProducts(body);
    //print
    console.dir(products);
  }
  while(!products.length);

  await browser.close(); //close browser puppeteer

  if(timer){
    let endTime = performance.now()
    console.log(`Call process took ${endTime - startTime} milliseconds`)
  }
  // return products;
})();

// Credit to chenxiaochun
// https://github.com/chenxiaochun/blog/issues/38
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

//get product and mapping data
async function getProducts(body){

  const $ = cheerio.load(body);
  const listItems = $(config["card-data"]);

  let products = [];
  listItems.each(function (idx, el) {
    
    let nama = $(config.name, el).text();

    //if nama available
    if(nama){
      let location = $(config.name, el).parent().children("div").last().text();
      let price = $(config.name, el).next().text();

      if((price.match(/Rp/g) || []).length > 1){
        price = price.split("Rp");
        price = price.join("-Rp").replace("-", "");
      }

      let link = 'https://www.shopee.co.id' + $(config.link, el).attr("href");
      let image = '';

      //push to return
      products.push({
        "nama": nama,
        "link": link,
        "price": price,
        "location": location
      });
    }

  });

  return products;
}

module.exports = scraper