import { createGame, updateGame, getGame, joinGame, getAllGames, leaveGame } from "../controllers/games.js";
import Game from "../models/games.js";

function gamesRoutes(app, io) {
	
    app.post(
        "/game",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            try {
                const game = await createGame(request.body.userId);
                io.emit('gameCreated', game);
                reply.code(200).send(game);
            } catch (error) {
                console.error('Error in route handler:', error);
                reply.code(500).send({
                    error: error.message || "Impossible de créer la partie"
                });
            }
        }
    );
	
	app.patch(
        "/game/join/:gameId",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const game = await joinGame(request.params.gameId, request.body.userId);
            if (game.error) {
                reply.status(500).send(game);
            } else {
                io.emit('gameUpdated', game);
                reply.send(game);
            }
        }
    );

    app.patch(
        "/game/:action/:gameId",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const game = await updateGame(request);
            if (game.error) {
                reply.status(500).send(game);
            } else {
                io.emit('gameUpdated', game);
                reply.send(game);
            }
        }
    );

    app.patch(
        "/game/:gameId/finish",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            try {
                const game = await Game.findByPk(request.params.gameId);
                if (!game) {
                    return reply.status(404).send({ error: "Game not found" });
                }

                const { winner, winnerScore } = request.body;

                if (!winner || typeof winnerScore !== 'number') {
                    return reply.status(400).send({ 
                      error: "Invalid request data",
                      received: request.body 
                    });
                }

                if (isNaN(winnerScore)) {
                    return reply.status(400).send({ error: "Invalid winner score" });
                }
                
                // Mise à jour unique de la partie
                const updatedGame = await game.update({
                    state: "finished",
                    winner: winner,
                    winnerScore: winnerScore,
                    updatedAt: new Date()
                });

                // Emit events to all players
                io.to(request.params.gameId).emit('gameEnded', {
                    gameId: request.params.gameId,
                    winner,
                    winnerScore
                });

                io.to(request.params.gameId).emit('gameStateUpdated', {
                    ...game.toJSON(),
                    state: 'finished',
                    gameOver: true,
                    winner: winner,
                    winnerScore: winnerScore
                });

                reply.send({ 
                    success: true,
                    winner: updatedGame.winner,
                    winnerScore: updatedGame.winnerScore,
                    state: updatedGame.state
                });
            } catch (error) {
                console.error('Error finishing game:', error);
                reply.status(500).send({ error: "Failed to end game" });
            }
        }
    );

    app.patch(
        "/game/leave/:gameId",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const result = await leaveGame(request.params.gameId, request.body.userId);
            if (result.error) {
                reply.status(500).send(result);
            } else {
                io.to(request.params.gameId).emit('gameUpdated', result);
                reply.send(result);
            }
        }
    );

    app.get(
        "/game/:gameId", 
        { preHandler: [app.authenticate] }, 
        async (request, reply) => {
            const game = await getGame(request.params.gameId);
            if (!game) {
                reply.status(404).send({ error: "Game not found" });
            } else {
                reply.send(game);
            }
        }
    );
	
	
    app.get(
        "/games", 
        { preHandler: [app.authenticate] }, 
        async (request, reply) => {
            const games = await getAllGames();
            reply.send(games);
        }
    );
}

export default gamesRoutes;
