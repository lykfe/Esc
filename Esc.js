ScoreBoard = new Mongo.Collection("scores");
Max = new Mongo.Collection('max');
Min = new Mongo.Collection('min');
GameStatus = new Mongo.Collection('gameStatus');
GameCountDown = new Mongo.Collection('gameCountDown');

if (Meteor.isClient)
{
    var previous;
    
	Template.body.helpers({
		ranks: function ()
		{
			var scoreboardCursor = ScoreBoard.find({}, {
				sort: { rank: -1, isRanked: -1 }
			});
			return scoreboardCursor;
		},
		announcementText: function ()
		{
			if (GameStatus.findOne() == null)
			{
				document.getElementById('announcement').innerHTML = 'GO! Guess a number';
			}
			else
			{
				document.getElementById('announcement').innerHTML = GameStatus.findOne().announcementText;
			}
		},
		countdown: function ()
		{
		    if (GameCountDown.findOne() != null)
		    {
		        var timeRemaining = GameCountDown.findOne().countDown;
		        console.log(timeRemaining);
		        return timeRemaining;
		    }
		    else
		    {
		        return 30;
		    }
		}
	});

	Template.number_range.helpers({
		high_num: function ()
		{
			var firstMax = Max.findOne();
			if (firstMax == null)
			{
				return 10000;
			}
			else
			{
				return Max.findOne().max;
			}
		},
		is_down_arrow: function ()
		{
			var lastInputNum = Max.findOne();
			if (lastInputNum == null)
			{
				return true;
			}
			else
			{
				return Max.findOne().isDown;
			}
		}
	});

	Template.body.events({
		"submit .new-chat": function (event)
		{
			var createdAt = new Date().getTime();
			// Prevent default browser form submit
			event.preventDefault();
			// Get value from form element
			var text = event.target.text.value;
			var username = event.target.username.value;
			document.getElementById('nameID').disabled = true;
			// Insert a task into the collection
			if (previous == null || (createdAt - previous >= 0))
			{
				var announcementText;
				Meteor.call('guessNumber', text, username, function (error, result)
				{
					if (error)
					{
						// handle error
					} else
					{
						announcementText = result;
					};
					console.log(announcementText);
					document.getElementById('announcement').innerHTML = announcementText;

					previous = createdAt;
					// Clear form
					event.target.text.value = "";
				});
			}
		}
	});
}

if (Meteor.isServer)
{
	var answer;
	// Keep track of number of players who got the right answer
	var finishedUserNum;
	var users;
	var lastInsertedNum;
	var lastInsertedHighId;
	var lastInsertedLowId;
	var startTimer;

	var resetGame = function ()
	{
		finishedUserNum = 0;
		users = {};
		Max.remove({});
		Min.remove({});
		ScoreBoard.remove({});
		answer = Math.floor((Math.random() * 999) + 1);
		GameStatus.remove({});
		GameStatus.insert({ announcementText: 'GO! Guess a number' });
	}

	resetGame();

	var isEveryoneFinished = function ()
	{
		var isDone = false;

		// Check if totalUserNum is not zero and equal to finishedUserNum
		var totalUserNum = Object.keys(users).length;
		console.log('totalUserNum: ' + totalUserNum);
		if (totalUserNum != 0 && totalUserNum == finishedUserNum)
		{
			isDone = true;
		}

		return isDone;
	}

	var sortUserByRank = function (map)
	{
		var tupleArray = [];
		for (var key in map) tupleArray.push([key, map[key]]);
		tupleArray.sort(function (a, b) { return a[1] - b[1] });
		return tupleArray;
	}

	Meteor.startup(function ()
	{
		resetGame();
	});

	var gameOver = function ()
	{
		GameStatus.remove({});
		GameStatus.insert({ announcementText: 'Everyone is Done!     Ranking is shown below' })
		console.log('gameOver');
		startTimer = 15000;
		countStartTimer();
	}

	var countStartTimer = function ()
	{
		console.log('countDown: ' + startTimer);

		if (startTimer <= 0)
		{
			console.log('resetting game');

			resetGame();
		}
		else if (startTimer <= 10000)
		{
			GameStatus.remove({});
			GameStatus.insert({ announcementText: 'Game will start in ' + startTimer / 1000 + '...' });
			startTimer -= 1000;
			Meteor.setTimeout(countStartTimer, 1000);
		}
		else
		{
			startTimer -= 1000;
			Meteor.setTimeout(countStartTimer, 1000);
		}
	}

	Meteor.methods({
		guessNumber: function (chat, username)
		{
			// Check if users has username
			if (users[username] == null)
			{
				// username is not in users
				var newUserId = ScoreBoard.insert({ score: '', isRanked: false, name: username });
				users[username] = {};
				users[username].userId = newUserId;
			}

			// Check if chat is a number
			if (isNaN(chat))
			{
				// It is not a number
				return 'You must enter a number';
			}
			else
			{
				// It is a number
				var chatInt = parseInt(chat);

				if (chatInt == answer)
				{
					// user guessed the correct number
					finishedUserNum++;
					users[username].rank = finishedUserNum;
					ScoreBoard.update(users[username].userId, {
						$set: { score: users[username].rank, isRanked: true, name: username }
					});
					if (isEveryoneFinished())
					{
						console.log('everyone is finished');
						gameOver();
					}
					return 'You got the correct answer!(' + chatInt + ')';
				}
				else if (chatInt > answer)
				{
					// guess was too high
					lastInsertedNum = chatInt;
					Max.remove({});
					lastInsertedHighId = Max.insert({ max: chatInt, isDown: true });
					if (lastInsertedLowId != null)
					{
						Min.update(lastInsertedLowId, {
							$set: { low_num_bullet_visibility: 'normal' }
						});
					}
					return '(' + chatInt + ')&darr;';
				}
				else
				{
					// guess was too low
					lastInsertedNum = chatInt;
					Max.remove({});
					lastInsertedLowId = Max.insert({ max: chatInt, isDown: false });
					if (lastInsertedHighId != null)
					{
						Max.update(lastInsertedHighId, {
							$set: { high_num_bullet_visibility: 'normal' }
						});
					}
					return '(' + chatInt + ')&uarr;';
				}
			}
		},

		isLastNumHigh: function ()
		{
			// check to see if last entered number is higher than the answer
			if (lastInsertedNum != null)
			{
				if (lastInsertedNum > answer)
				{
					return true;
				}
			}
			return false;
		}
	});
}
