const { App } = require("@slack/bolt")
const { shuffle, chunk, random } = require("./helpers")

const token = process.env.SLACK_BOT_TOKEN

const chunkSize = 4
const baseMessage = ":wave: Try having a call with each other at some point this week"

const bot = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token,
})

run()

async function run() {
  const allUsers = await getAllUsers()

  var { ok, error, members } = await bot.client.conversations.members({
    channel: "C018P11DRBL", // virtual-coffee
    token,
  })
  if (!ok) {
    console.error(error)
    return
  }

  const users = allUsers.filter((user) => {
    const isInChannel = !!members.find((userId) => user.id === userId)
    return isInChannel && !user.is_bot
  })

  const admins = users.filter(({ is_admin, name }) => {
    return is_admin && name !== "grid-admin"
  })

  let message = baseMessage
  try {
    const question = await getRandomQuestion()
    message += `\nHere's something that can get you started:\n\n${question}`
  } catch (error) {
    console.error(error)
  }

  const userGroups = chunk(shuffle(users), chunkSize)

  const nameGroups = userGroups.map((userGroup) => {
    return userGroup.map(({ id }) => {
      const user = findUserById(id, users)
      return user.real_name
    })
  })

  const names = nameGroups
    .map((group, index) => {
      const names = group
        .map((name) => {
          return `> ${name}`
        })
        .join("\n")
      return `${index + 1}. \n${names}`
    })
    .join("\n")

  const today = new Date().toLocaleDateString()

  const promises = userGroups.map((users) => {
    const ids = users.map(({ id }) => id)
    const leader = findUserById(random(ids), users)

    return sendMessageToGroup(
      ids,
      `${message}\n\n${leader.real_name} is the leader this week!`
    )
  })

  console.log(`*Groups for ${today}:*\n${names}`)

  promises.push(
    sendMessageToGroup(
      admins.map(({ id }) => id),
      `*Groups for ${today}:*\n${names}`
    )
  )

  await Promise.all(promises)
}

async function getAllUsers() {
  var { ok, error, members } = await bot.client.users.list({
    channel: "C018P11DRBL",
    token,
  })
  if (!ok) {
    console.error(error)
    return
  }

  return members
}

function findUserById(id, users) {
  return users.find(user => user.id === id)
}

async function sendMessageToGroup(ids, message) {
  try {
    var { ok, error, channel } = await bot.client.conversations.open({
      users: ids.join(","),
      token,
    })
    if (!ok) {
      console.error(error)
      return
    }

    var { ok, error } = await bot.client.chat.postMessage({
      token,
      channel: channel.id,
      text: message,
    })
    if (!ok) {
      console.error(error)
      return
    }
  } catch (error) {
    console.log(error)
  }
}

async function getRandomQuestion() {
  const { status, statusText, data } = await bot.axios.get(
    "https://conversationstartersworld.com/random-question-generator/"
  )
  if (status != 200) {
    console.error(statusText)
    return
  }

  const [_, question] = data.match(/<p>(.+)<\/p><\/blockquote>/)
  return question
}
