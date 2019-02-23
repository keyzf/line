import test from 'ava'
import puppeteerHelper from '@ianwalter/puppeteer-helper'

const withPage = puppeteerHelper([
  './node_modules/@ianwalter/subpub/dist/subpub.iife.js',
  './dist/line.iife.js'
])

async function createIframe (page, name = 'test') {
  await page.evaluate(() => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('name', 'test')
    document.body.appendChild(iframe)
  })
  const iframe = page.frames().find(frame => frame.name() === name)
  await iframe.addScriptTag({ path: './dist/line.iife.js' })
  return iframe
}

test('main frame topic subscriber gets called', withPage, async (t, page) => {
  // Create an iframe within the page.
  const iframe = await createIframe(page)

  // Add the topic subscriber to the main frame.
  await page.evaluate(() => {
    const line = new Line(window.frames[0])
    line.sub('dogs', data => (window.received = data))
  })

  // Send a test message to the main frame from the iframe.
  await iframe.evaluate(() => {
    const line = new Line()
    line.msg('dogs', { loyal: true })
    line.end()
  })

  // Assert that the test message was received.
  t.deepEqual(
    await page.evaluate(() => window.received),
    { topic: 'dogs', loyal: true }
  )
})

test(`main frame message doesn't match source`, withPage, async (t, page) => {
  // Create an iframe within the page.
  await createIframe(page)

  const received = await page.evaluate(() => {
    // Set up a line instance that subscribes to messages from the iframe.
    const line = new Line(window.frames[0])
    line.sub('dogs', data => (window.received = data))

    // Post a test message from a source other than the iframe (the main frame
    // itself).
    window.postMessage({ topic: 'dogs', loyal: true }, '*')

    // Return whatever data was received.
    return window.received
  })

  // Assert that the test message was not recieved.
  t.is(received, undefined)
})

test('child frame topic subscriber gets called', withPage, async (t, page) => {
  // Create an iframe within the page.
  const iframe = await createIframe(page)

  // Set up a Line instance and subscribe to the topic.
  await iframe.evaluate(() => {
    const line = new Line()
    line.sub('dogs', data => (window.received = data))
  })

  // Set up a message event listener that will received the test message and
  // save the event data to the window.
  await page.evaluate(() => {
    const line = new Line(window.frames[0])
    line.msg('dogs', { loyal: true })
    line.end()
  })

  // Assert that the messsage was received.
  t.deepEqual(
    await iframe.evaluate(() => window.received),
    { topic: 'dogs', loyal: true }
  )
})

test(`child frame message doesn't match source`, withPage, async (t, page) => {
  // Create an iframe within the page.
  const iframe = await createIframe(page)

  // Set up a Line instance and subscribe to the topic.
  const received = await iframe.evaluate(() => {
    const line = new Line()
    line.sub('dogs', data => (window.received = data))

    // Post a test message from a source other than the main frame (the iframe
    // itself).
    window.postMessage({ topic: 'dogs', loyal: true }, '*')

    // Return whatever data was received.
    return window.received
  })

  // Assert that the test message was not recieved.
  t.is(received, undefined)
})

test('hasParent detects when in the child frame', withPage, async (t, page) => {
  const iframe = await createIframe(page)
  t.true(await iframe.evaluate(() => Line.hasParent()))
})