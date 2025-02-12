import { Server as SocketIOServer } from "socket.io";
import http from "http";
import chalk from "chalk";
//pour fastify
import fastify from "fastify";
import fastifyBcrypt from "fastify-bcrypt";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyJWT from "@fastify/jwt";
import socketioServer from "fastify-socket.io";
//routes
import { usersRoutes } from "./routes/users.js";
import gamesRoutes from "./routes/games.js";
//bdd
import { sequelize } from "./bdd.js";

const API_URL = import.meta.env.VITE_API_URL;
const URL_FRONT = import.meta.env.VITE_URL_FRONT;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const socket = io(`${SOCKET_URL}`);

//Test de la connexion
try {
	await sequelize.authenticate();
	console.log(chalk.grey("Connecté à la base de données MySQL!"));
} catch (error) {
	console.error("Impossible de se connecter, erreur suivante :", error);
}

const app = fastify();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
	cors: {
		origin: [
			URL_FRONT,
			"http://localhost:5173",
			"https://morris-teal.vercel.app",
			"https://morris-game.netlify.app"
		],
		methods: ['GET', 'POST', 'PATCH'],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"]
	},
});

let blacklistedTokens = [];
const games = {};


//Ajout du plugin fastify-bcrypt pour le hash du mdp
await app
	.register(fastifyBcrypt, {
		saltWorkFactor: 12,
	})
	.register(cors, {
		origin: [
			URL_FRONT,
			"http://localhost:5173", 
			"https://morris-teal.vercel.app",
			"https://morris-game.netlify.app"
		  ],
		methods: ["GET", "POST", "PATCH"],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"]
	})
	.register(fastifyJWT, { secret: "unanneaupourlesgouvernertous" })
	.register(fastifySwagger, {
		openapi: {
			openapi: "3.0.0",
			info: {
				title: "Documentation de l'API JDR LOTR",
				description:
					"API développée pour un exercice avec React avec Fastify et Sequelize",
				version: "0.1.0",
			},
		},
	})
	.register(fastifySwaggerUi, {
		routePrefix: "/documentation",
		swaggerOptions: {
			url: '/documentation/json',
		},
		theme: {
			title: "Docs - JDR LOTR API",
		},
		uiConfig: {
			docExpansion: "list",
			deepLinking: false,
		},
		uiHooks: {
			onRequest: function (request, reply, next) {
				next();
			},
			preHandler: function (request, reply, next) {
				next();
			},
		},
		staticCSP: true,
		transformStaticCSP: (header) => header,
		transformSpecification: (swaggerObject, request, reply) => {
			return swaggerObject;
		},
		transformSpecificationClone: true,
	})
	.register(socketioServer, {
		cors: {
			origin: [URL_FRONT, "http://localhost:5173", "https://morris-teal.vercel.app"],
			methods: ["GET", "POST", "PATCH"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization"]
		}
	});

server.listen(3001, '0.0.0.0', () => {
	console.log('Socket.IO écoute sur http://0.0.0.0:3001');
});

/**********
 * Routes
 **********/
app.get("/", (request, reply) => {
	reply.send({ documentationURL: `${API_URL}/documentation` });
});

// Fonction pour décoder et vérifier le token
app.decorate("authenticate", async (request, reply) => {
	try {
		const token = request.headers["authorization"].split(" ")[1];

		// Vérifier si le token est dans la liste noire
		if (blacklistedTokens.includes(token)) {
			reply.send({ error: "Token is blacklisted" });
		}
		await request.jwtVerify();
	} catch (err) {
		reply.send(err);
	}
});

usersRoutes(app, blacklistedTokens);
gamesRoutes(app, io);

/**********
 * START
 **********/
const start = async () => {
	try {
		await sequelize
			.sync({ alter: true })
			.then(() => {
				console.log(chalk.green("Base de données synchronisée."));
			})
			.catch((error) => {
				console.error(
					"Erreur de synchronisation de la base de données :",
					error
				);
			});
		await app.listen({ 
			port: 3000,
			host: '0.0.0.0'
		});
	} catch (err) {
		console.log(err);
		process.exit(1);
	}
	console.log(
		"Serveur Fastify lancé sur " + chalk.blue("http://0.0.0.0:3000")
	);
	console.log(
		chalk.bgYellow(
			"Accéder à la documentation sur", `${API_URL}/documentation`
		)
	);

	let gameState = {
		board: Array(24).fill(null),
		currentPlayer: "black",
	};

	io.on("connection", (socket) => {

		socket.on("initGame", ({ gameId, userId, username, role, isCreator }) => {
			socket.join(gameId);

			if (!games[gameId]) {
				games[gameId] = {
					board: Array(24).fill(null),
					currentPlayer: "black",
					phase: "waiting",
					players: [],
					state: "pending",
					piecesToPlace: { black: 9, white: 9 },
					capturedPieces: { black: 0, white: 0 }
				};
			}

			// Create player info with username
			const playerInfo = {
				id: userId,
				username: username || `Player ${role}`,
				role: role,
				isCreator: isCreator,
				isReady: false
			};

			// Update or add player
			const existingPlayerIndex = games[gameId].players.findIndex(p => p.id === userId);
			if (existingPlayerIndex >= 0) {
				games[gameId].players[existingPlayerIndex] = playerInfo;
			} else if (games[gameId].players.length < 2) {
				games[gameId].players.push(playerInfo);
			}
			// Broadcast updates
			io.to(gameId).emit('playersUpdated', games[gameId].players);
			io.to(gameId).emit("gameStateUpdated", {
				...games[gameId]
			});
		});

		socket.on("updateGameState", async ({ gameId, ...newState }) => {
			const game = games[gameId];

			if (game) {

				// Si le jeu a un gagnant, forcer l'état à "finished"
				const shouldFinish = newState.winner || newState.gameOver;

				// Mettre à jour l'état du jeu
				games[gameId] = {
					...games[gameId],
					...newState,
					board: newState.board,
					currentPlayer: newState.currentPlayer,
					phase: shouldFinish ? 'finished' : newState.phase,
					winner: newState.winner,
					winnerScore: newState.winnerScore,
					gameOver: newState.gameOver,
					state: shouldFinish ? 'finished' : newState.state,
					players: game.players,
					lastUpdate: Date.now()
				};

				// Si le jeu est terminé, forcer l'état à "finished"
				if (newState.gameOver || newState.phase === 'finished') {
					games[gameId].state = 'finished';
					games[gameId].phase = 'finished';
				}

				// Si le jeu a un gagnant, mettre à jour la base de données
				if (shouldFinish) {
					try {
						// Mise à jour de la base de données
						await fetch(`${API_URL}/game/${gameId}/finish`, {
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								winner: newState.winner,
								winnerScore: newState.winnerScore,
							})
						});
					} catch (error) {
						console.error('Error saving game result:', error);
					}
				}

				// Diffuser à tous les joueurs dans la salle Y COMPRIS l'expéditeur
				io.in(gameId).emit("gameStateUpdated", games[gameId]);

				// Si le jeu est terminé, émettre l'événement de fin
				if (shouldFinish) {

					io.in(gameId).emit("gameEnded", {
						gameId,
						winner: games[gameId].winner,
						winnerScore: games[gameId].winnerScore,
						state: 'finished'
					});
				}
			}
		});

		socket.on("setReady", ({ gameId, userId, isReady }) => {
			const game = games[gameId];
			if (!game) {
				return;
			}

			const playerIndex = game.players.findIndex(p => p.id === userId);
			if (playerIndex !== -1) {
				// Update player ready state
				game.players[playerIndex].isReady = isReady;

				// Broadcast to ALL clients in the room
				io.in(gameId).emit('playersUpdated', game.players);

				// Check if game should start
				const allReady = game.players.length === 2 &&
					game.players.every(p => p.isReady);

				if (allReady) {

					// Find the creator player
					const creatorPlayer = game.players.find(p => p.isCreator === true);

					if (creatorPlayer) {
						game.phase = "placement";
						game.state = "playing";
						game.currentPlayer = "black";
						game.isStarted = true;
						creatorPlayer.isMyTurn = true;

						// Update game state for all players		
						io.in(gameId).emit("gameStateUpdated", game);
						io.in(gameId).emit("gameStart", game);
					}
				}
			}
		});

		socket.on("disconnect", () => {
			// console.log(`Utilisateur déconnecté ${socket.id}`);
		});

		// Add timeout check for inactive games
		setInterval(() => {
			Object.entries(games).forEach(([gameId, game]) => {
				if (game.lastUpdate && Date.now() - game.lastUpdate > 5 * 60 * 1000) {
					// Remove inactive game after 5 minutes
					delete games[gameId];
					io.to(gameId).emit("gameTimeout");
				}
			});
		}, 60000);
	});
};

async function updateGameResult(gameId, winner) {
	try {
		// Update game result in database
		await Game.update(
			{
				state: "finished",
				winner: winner
			},
			{
				where: { id: gameId }
			}
		);
	} catch (error) {
	}
}

start();
