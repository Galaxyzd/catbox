const discord 	= require('discord.js')
const file		= require('fs')
const bot 		= new discord.Client()
const cfg 		= require("./cfg/config.json")
const cmds 		= require("./cfg/commands.json")
const txt		= require("./res/strings.json")
const command 	= require("./lib/commandhandler.js")
var leaderboard = require("./data/leaderboard.json")
var currency	= require("./data/currency.json")
var temp		= require("./data/temp.json")
var maintenance = false
var betRound	= { roundTime: 30, roundInterval: 5, inProgress: false, total: 0, players: {} }

command.init(bot, cmds)

command.linkCommand('help', (msg) => {
	let categories = []
	Object.keys(cmds).forEach(cmd => {
		if (!categories.includes(cmds[cmd].category)) { categories.push(cmds[cmd].category) }
	}); 
	let embed = new discord.RichEmbed()
	.setAuthor('Catbox Commands', 'https://cdn.discordapp.com/attachments/456889532227387405/538354324028260377/youwhat_hd.png')
	.setColor(cfg.embedcolor)
	.setTimestamp()
	categories.forEach(cat => {
		let txt = ""
		Object.keys(cmds).forEach(cmd => {
			if (cmds[cmd].category === cat)
			{
				txt += `\`${cfg.prefix}${cmd} ${String(cmds[cmd].args).replace(',',' ')}\`­­­­­­­­­­­­­­­:\n${cmds[cmd].tip}\n\n`
			}
		});
		embed.addField(cat + " commands", txt)
	});
	msg.channel.send({embed})
})

command.linkCommand('about', (msg) => {
	msg.channel.send({
		embed: 
		{
			color: cfg.embedcolor,
			author:
			{
				name: `${bot.users.get(cfg.author).username} and ${bot.users.get(cfg.operators[1]).username}`,
				icon_url: bot.users.get(cfg.author).avatarURL
			},
			fields: 
			[
				{
					name: "Author",
					value: `${bot.user.username} was made by ${bot.users.get(cfg.author).tag} and ${bot.users.get(cfg.operators[1]).tag}.`
				},
				{
					name: "Hosting",
					value: txt.ad_text
				}
			],
			footer: 
			{
			  icon_url: cfg.about_img,
			  text: txt.ad_title
			}
		}
	})
})

command.linkCommand('send', (msg, name, message) => {
	let channel = getChannel(msg.guild, name)
	if (channel != undefined) { channel.send(message) }
	else { msg.channel.send(txt.err_no_channel) }
})

command.linkCommand('leaderboard', (msg) => {
	leaderboard = require("./data/leaderboard.json")
	currency = require("./data/currency.json")

	let richestUsers = Object.keys(currency).sort((a, b) => {
		if (bot.users.get(a) != undefined) { return currency[a] - currency[b] }
	})
	richestUsers = richestUsers.reverse().slice(0, Math.min(richestUsers.length, 10))
	let highestStreaks = Object.keys(leaderboard).sort((a, b) => {
		if (bot.users.get(a) != undefined) { return leaderboard[a] - leaderboard[b] }
	})
	highestStreaks = highestStreaks.reverse().slice(0, Math.min(highestStreaks.length, 5))

	let streakStr = richStr = ''
	let embed = new discord.RichEmbed()
	.setAuthor('Catbox Leaderboard', 'https://cdn.discordapp.com/attachments/456889532227387405/538354324028260377/youwhat_hd.png')
	.setColor(cfg.embedcolor)
	.setTimestamp()

	for (let i = 0; i < richestUsers.length; i++) {
		const bal = currency[richestUsers[i]];
		richStr += `\`${('0' + (i + 1)).slice(-2)}.\` ${bal} ${pluralize("cat", bal)} - **${bot.users.get(richestUsers[i]).username}**\n`
	}
	embed.addField('10 Richest Users', richStr)

	embed.addBlankField()

	for (let i = 0; i < highestStreaks.length; i++) {
		const score = leaderboard[highestStreaks[i]];
		streakStr += `\`${('0' + (i + 1)).slice(-2)}.\` ${score} ${pluralize("cat", score)} - **${bot.users.get(highestStreaks[i]).username}**\n`
	}

	embed.addField('5 Highests Catstreaks', streakStr)
	msg.channel.send({embed})
})

command.linkCommand('give', (msg, member, amount) => {
	if (member instanceof Array) {
		member.forEach(m => {
			changeBalance(m.id, amount)
		});

		msg.channel.send(`**Everyone** has received ${amount} ${pluralize("cat", amount)}.`)
	} else {
		changeBalance(member.id, amount, _ => {
			msg.channel.send(`**${member.displayName}** was granted ${amount} ${pluralize("cat", amount)}`)
		})
	}
})

command.linkCommand('balance', (msg, member) => {
	let user = member ? member.user : msg.author

	let bal = getBalance(user.id)
	msg.channel.send(`**${user.username}** has ${bal} ${pluralize("cat", bal)}`)
})

command.linkCommand('maintenance', (msg, bool) => {
	if (bool)
	{
		bot.guilds.forEach(guild => {
			guild.members.get(bot.user.id).setNickname(bot.user.username + " (maintenance)")
		});
		msg.channel.send("Maintenance mode enabled.")
		print("Maintenance mode enabled.")
	}
	else
	{
		bot.guilds.forEach(guild => {
			guild.members.get(bot.user.id).setNickname(bot.user.username)
		});
		msg.channel.send("Maintenance mode disabled.")
		print("Maintenance mode disabled.")
	}
	maintenance = bool
})

command.linkCommand('guess', (msg, guess) => {
	let user = msg.author

	if (temp.guessRound.num === false) {
		temp.guessRound.max = randomInt(1, 5) * 100
		temp.guessRound.num = randomInt(0, temp.guessRound.max)
		temp.guessRound.total = Math.round(temp.guessRound.max / 20)
		file.writeFile("./data/temp.json", JSON.stringify(temp), (err) => {})
	}

	if (!guess) { msg.channel.send(generateGuessRoundEmbed()) }
	else {
		if (getBalance(user.id) <= 0) { msg.channel.send(txt.err_no_cats); return }
		if (temp.guessRound.guessed.includes(guess)) { msg.channel.send("This number is not available."); return }
		changeBalance(user.id, -1)
		temp.guessRound.guessed.push(guess)
		temp.guessRound.total++

		if (guess === temp.guessRound.num) {
			msg.channel.send(`**${user.username}** won ${temp.guessRound.total} ${pluralize("cat", temp.guessRound.total)}! Winning number was ${temp.guessRound.num}.`)
			changeBalance(user.id, temp.guessRound.total)
			temp.guessRound.num = false;
			temp.guessRound.guessed = []
		} else {
			msg.channel.send(`**${user.username}** guessed number ${guess}.`)
			msg.channel.send(generateGuessRoundEmbed())
			file.writeFile("./data/temp.json", JSON.stringify(temp), (err) => {})
		}
	}
})

command.linkCommand('bet', (msg, amount) => {
	let roundMsg = null; let user = msg.author
	if (getBalance(user.id) < amount) { msg.channel.send(txt.err_no_cats); return }
	if (amount <= 0) { msg.channel.send(txt.err_invalid_amt); return }
	changeBalance(user.id, -amount)
	betRound.total += amount
	if (betRound.players.hasOwnProperty(user.id)) {
		msg.channel.send(`**${user.username}** added ${amount} ${pluralize("cat", amount)}.`)
		betRound.players[user.id] += amount
		return
	} else {
		betRound.players[user.id] = amount
	}

	if (!betRound.inProgress)
	{
		betRound.inProgress = true
		betRound.startTime = new Date().getTime()
		msg.channel.send(`**${user.username}** just started a betting round with ${amount} ${pluralize("cat", amount)}! You have ${betRound.roundTime} seconds to join in!`)
		msg.channel.send(generateRoundEmbed()).then(msg => roundMsg = msg)
		var IID = setInterval(() => { roundMsg.edit("", generateRoundEmbed()) }, betRound.roundInterval * 1000);
		setTimeout(() => {
			clearInterval(IID)
			roundMsg.edit("", generateRoundEmbed())

			let winner = undefined; let winNum = Math.random(); let total = 0;
			shuffleArray(Object.keys(betRound.players)).forEach(ply => {
				total += betRound.players[ply] / betRound.total
				if (total >= winNum && winner == undefined) { winner = ply }
			});
			msg.channel.send(`**${bot.users.get(winner).username}** won ${betRound.total} ${pluralize("cat", betRound.total)} with a ${((betRound.players[winner] / betRound.total) * 100).toFixed(2)}% chance!`)
			changeBalance(winner, betRound.total)
			betRound.inProgress = false; betRound.total = 0; betRound.players = {}
		}, betRound.roundTime * 1000);
	}
	else
	{
		msg.channel.send(`**${user.username}** joined the current betting round with ${amount} ${pluralize("cat", amount)} (${((amount / betRound.total) * 100).toFixed(2)}% chance).`)
	}
})

setInterval(() => {
	let d = new Date()
	if (d.getMinutes() === 0)
	{
		file.copyFileSync("./data/currency.json", `./data/backups/currency-${d.toISOString().substr(0, 13)}.json`)
		file.copyFileSync("./data/leaderboard.json", `./data/backups/leaderboard-${d.toISOString().substr(0, 13)}.json`)
		bot.users.forEach(user => {
			changeBalance(user.id, 2)
		});
		bot.guilds.forEach(guild => {
			guild.channels.find(x => x.name === "cat").send(`**Everyone** has received 2 cats.`)
		});
		cooldowns = {}
		print("Backups were made and hourly cats given out.")
	}
}, 60000);

const underbox		= '456889532227387403'
const youwhat		= '<:youwhat:534811127461445643>'
const odds			= 0.5
var cooldowns 		= {}

// Events
bot.on("ready", () =>
{
	print(`Logged in as ${bot.user.tag}!`)
	print(`Currently serving ${bot.guilds.size} servers and ${bot.users.size} users.\n`)
	bot.user.setPresence({
		game: 
		{
			name: cfg.activity,
			type: cfg.activityType.toUpperCase()
		}
	})
});

bot.on("message", (msg) =>
{
	msg.content = msg.cleanContent

	if (maintenance && msg.content !== `${cfg.prefix}maintenance false`) { return }

	if (msg.guild.id == underbox && msg.content.includes(youwhat) && msg.content != youwhat && msg.author.id != bot.user.id) // Reacts to any message with youwhat
	{
		msg.react(youwhat.match(/(?<=:)\d+(?=>)/)[0]) // This is super inefficient but whatever
	}

	if (msg.guild.id == underbox && msg.content == youwhat && msg.author.id != bot.user.id) 
	{ 
		if (getBalance(msg.author.id) > 0) { sendCat(msg) }
		else { msg.channel.send(txt.warn_no_cats) }
	}

	// Return if message is either from a bot or doesn't start with command prefix. Keep non-commands above this line.
	if (msg.author.bot || msg.content.substring(0, cfg.prefix.length) !== cfg.prefix) { return }

	let t = new Date().getTime()
	if (cooldowns[msg.author.id] > t) { msg.channel.send(txt.warn_cooldown); return }
	else { cooldowns[msg.author.id] = t + cfg.cooldown }

	const args = msg.content.slice(cfg.prefix.length).trim().split(/ +(?=(?:(?:[^"]*"){2})*[^"]*$)/g)
	const cmd = args.shift().toLowerCase()
	
	for (let i = 0; i < args.length; i++) 
	{
		if (args[i].charAt(0) == `"`) { args[i] = args[i].substring(1, args[i].length) }
		if (args[i].charAt(args[i].length - 1) == `"`) { args[i] = args[i].substring(0, args[i].length - 1) }
	}

	try { 
		cmds[cmd].command.run(msg, args) 
	} catch (err) { 
		console.log(err)

		if (err.message == undefined) {
			msg.channel.send("" + err)
		} else {
			msg.channel.send("Internal error: " + err.message)
		}
	}
});

function print(msg)
{
	var time = new Date().toISOString().substr(11, 8)
    console.log(`(${time}) ${msg}`)
}

function sendCat(msg)
{
	changeBalance(msg.author.id, -1)
	let catStreak = 0
	let rng = Math.random()
	let cats = ""
    while (rng >= odds)
	{
		cats += youwhat
		catStreak++
		rng = Math.random()
	}
	if (catStreak > 0)
	{
		saveHighscore(msg.author.id, catStreak)
		changeBalance(msg.author.id, catStreak)
		msg.channel.send(`**${msg.author.username}** earned ${catStreak} ${pluralize("cat", catStreak)} (${(Math.pow(odds, catStreak) * 100).toFixed(2)}% chance)\n${cats}`)
	}
}

function generateRoundEmbed()
{
	let pList = ""
	let embed = new discord.RichEmbed()
	.setAuthor(`Betting Round - Total: ${betRound.total} ${pluralize("cat", betRound.total)}`, 'https://cdn.discordapp.com/attachments/456889532227387405/538354324028260377/youwhat_hd.png')
	.setColor(cfg.embedcolor)
	Object.keys(betRound.players).forEach(ply => {
		let curAmount = betRound.players[ply]
		pList += `${curAmount} ${pluralize("cat", curAmount)} (${((curAmount / betRound.total) * 100).toFixed(2)}%) - **${bot.users.get(ply).username}**\n`
	});
	embed.setDescription(pList)
	let timeLeft = Math.round(betRound.roundTime - (new Date().getTime() - betRound.startTime) / 1000)
	embed.setFooter(`${timeLeft} seconds left.`)
	if (timeLeft <= 0) {embed.setFooter('This round is over.')}
	return embed
}

function generateGuessRoundEmbed()
{
	let numList = `Maximum guess for this round: ${temp.guessRound.max}\nGuessed numbers: `
	let embed = new discord.RichEmbed()
	.setAuthor(`Guessing Round - Total: ${temp.guessRound.total} ${pluralize("cat", temp.guessRound.total)}`, 'https://cdn.discordapp.com/attachments/456889532227387405/538354324028260377/youwhat_hd.png')
	.setColor(cfg.embedcolor)
	if (temp.guessRound.guessed[0] !== undefined && temp.guessRound.guessed[0] !== null) {
		let nums = temp.guessRound.guessed.sort((a, b) => temp.guessRound.guessed[a] - temp.guessRound.guessed[b])
		for (let i = 0; i < nums.length - 1; i++) {
			numList += `${nums[i]}, `
		}
		numList += nums[nums.length - 1]
	} else { numList += "none" }
	embed.setDescription(numList)
	return embed
}

function getMember(guild, identifier)
{
	identifier = identifier.toLowerCase()
	let member = undefined
	member = guild.members.find(x => x.id === identifier || x.user.username.toLowerCase() === identifier || ((x.nickname !== null) ? x.nickname.toLowerCase() === identifier : false))
	return member
}

function getChannel(guild, identifier)
{
	identifier = identifier.toLowerCase()
	let channel = undefined
	channel = guild.channels.find(x => x.id === identifier || x.name === identifier)
	return channel
}

function saveHighscore(userID, score)
{
	var filename = "./data/leaderboard.json"
	leaderboard = require(filename)
	if (!leaderboard.hasOwnProperty(userID))
	{
		leaderboard[userID] = score
		file.writeFile(filename, JSON.stringify(leaderboard), (err) => {})
	}
	else if (leaderboard[userID] < score) 
	{ 
		leaderboard[userID] = score
		file.writeFile(filename, JSON.stringify(leaderboard), (err) => {})
	}
}

function changeBalance(userID, amount, callback)
{
	var filename = "./data/currency.json"
	currency = require(filename)

	if (currency.hasOwnProperty(userID)) {
		currency[userID] += amount
	} else { 
		currency[userID] = amount
	}

	file.writeFile(filename, JSON.stringify(currency), (err) => {})

	if (callback != null) {
		callback()
	}
}

function getBalance(userID)
{
	currency = require("./data/currency.json")
	let bal = 0

	if (currency.hasOwnProperty(userID)) 
	{
		bal = currency[userID]
	}
	return bal
}

function randomInt(min, max)
{
	return Math.round(Math.random() * (max - min) + min)
}

function pluralize(word, count)
{
	if (Math.abs(count) != 1) { return word + "s" }
	else { return word }
}

function replaceVar(str, arg)
{
	return str.replace(/%\w+%/g, arg)
}

function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    } return a;
}

bot.login(cfg.token)