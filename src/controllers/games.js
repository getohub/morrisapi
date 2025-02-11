import Game from "../models/games.js";
import User from "../models/users.js";

export async function createGame(userId) {
	if (!userId) {
        console.error("User ID is missing");
		return { error: "L'identifiant du joueur est manquant" };
	}
	try {        
        const user = await User.findByPk(userId);
        if (!user) {
          console.error("User not found:", userId);
          return { error: "Utilisateur non trouvé" };
        }

        const game = await Game.create({ 
            creator: userId,
            state: "pending",
            currentPlayer: "O"
        });

        return { 
            creatorUsername: user.dataValues.username,
            gameId: game.dataValues.id,
            creator: game.dataValues.creator
        };
	} catch (error) {
		console.error("Erreur lors de la création de la partie :", error);
		return { error: "Impossible de créer la partie." };
	}
}

export async function joinGame(gameId, userId) {
    try {
        const game = await Game.findByPk(gameId);

        if (!game) {
            return { error: "Partie non trouvée" };
        }
        
        if (game.creator === userId) {
            return { error: "Vous ne pouvez pas rejoindre votre propre partie" };
        }

        // User is already part of the game
        if (game.player === userId || game.creator === userId) {
            return game;
        }
        if (game.player) {
            return { error: "Cette partie est déjà complète" };
        }
        game.player = userId;
        game.state = "playing";
        await game.save();
        return game;
    } catch (error) {
        console.error("Error joining game:", error);
        return { error: "Erreur lors de la jointure de la partie" };
    }
}

export async function getGame(gameId) {
    try {
        const game = await Game.findByPk(gameId);
        if (!game) {
            return { error: "Game not found" };
        }
        return game;
    } catch (error) {
        console.error("Error fetching game:", error);
        return { error: "Failed to fetch game" };
    }
}

export async function getAllGames() {
    try {
        const games = await Game.findAll();
        return games;
    } catch (error) {
        return { error: "Failed to fetch games" };
    }
}

export async function updateGame(request) {
    const { action, gameId } = request.params;
    const userId = request.body.userId;

    if (request.params.length < 2) {
        return { error: "Il manque des paramètres" };
    }
    if (!userId) {
        return { error: "L'identifiant du joueur est manquant" };
    } else if (!gameId) {
        return { error: "L'identifiant de la partie est manquant" };
    }

    try {
        const game = await Game.findByPk(gameId);
        if (!game) {
            return { error: "La partie n'existe pas." };
        }

        // Check if game is already finished before allowing any action
        if (game.state === "finished" && action !== "finish") {
            return { error: "Cette partie est déjà terminée ! Aucune action supplémentaire n'est possible." };
        }

        // Rest of your switch statement logic
        switch (action) {
            case "join":
                if (game.dataValues.player != null) {
                    return { error: "Il y a déjà 2 joueurs dans cette partie !" };
                }
                if (game.dataValues.state != "pending") {
                    return { error: "Cette partie n'est plus en attente." };
                }
                await game.setPlayer2(userId);
            case "start":
                game.state = "playing";

                break;
            case "finish":
                game.state = "finished";
                if (!request.body.score) {
                    return { error: "Le score est manquant." };
                }
                game.winnerScore = request.body.winnerScore;
                game.winner = request.body.winner;
                break;
            default:
                return { error: "Action inconnue" };
        }

        await game.save();
        return game;

    } catch (error) {
        console.error("Error updating game:", error);
        return { error: "Failed to update game" };
    }
}

export async function leaveGame(gameId, userId) {
    try {
        const game = await Game.findByPk(gameId);
        if (!game) {
            return { error: "Game not found" };
        }

        if (game.creator === userId) {
            game.creator = null;
        } else if (game.player2 === userId) {
            game.player2 = null;
        }

        await game.save();
        return game;
    } catch (error) {
        console.error("Error leaving game:", error);
        return { error: "Failed to leave game" };
    }
}