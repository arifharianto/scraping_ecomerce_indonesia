const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const config = require('./config.json').tokopedia;
const randomUseragent = require('random-useragent');
const uaTool = require("useragent-tool");
const commander = require('commander');
const program = new commander.Command();

program
  .requiredOption('-q, --search <string>', 'search query')
  .option('-ob, --sort <number>', 'sort')
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

  const url = `https://www.tokopedia.com/search?ob=${program.opts().sort?program.opts().sort:23}&st=product&q=${program.opts().search.split(' ').join('%20')}`;
  
  let randomUserAgent = uaTool.getRandomUserAgent();
  let products = [];
  
  do{
    randomUserAgent = uaTool.getRandomUserAgent();
    console.log("this User agent :", randomUserAgent);
    const browser = await puppeteer.launch({
      args: [
        "--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure",
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    const context = await browser.createIncognitoBrowserContext(); //incognito
    const page = await context.newPage();
    await page.setJavaScriptEnabled(true); //enable js

    //setting user agent
    await page.setUserAgent(randomUserAgent);
    await page.goto(url, { waituntil: 'domcontentloaded', timeout: 0 }); //wait download pagenya selesai

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
      var nama = $(config.name, el).text();
      var location = $(config.location, el).text();
      var price = $(config.price, el).text();
      var image = $(config.thumb, el).attr("src");
      var link = $(config.link, el).attr("href");
      var seller = $(config.seller, el).text();
      var sold = $(config.sold, el).text();
      
      if (price != null && price != "") {
        products.push({
          "nama": nama,
          "seller": seller,
          "location": location,
          "harga": price,
          "terjual": sold,
          "image": image,
          "link": link
        });
      }

  });

  return products;
}

module.exports = scraper