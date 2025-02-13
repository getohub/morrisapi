import {
	getUserById,
	getUsers,
	loginUser,
	registerUser,
} from "../controllers/users.js";

export function usersRoutes(app, blacklistedTokens ) {
	app.post("/login", async (request, reply) => {
		reply.send(await loginUser(request.body, app));
	}).post(
		"/logout",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			const token = request.headers["authorization"].split(" ")[1];

			
			blacklistedTokens.push(token);

			reply.send({ logout: true });
		}
	);

	app.post("/register", async (request, reply) => {
		reply.send(await registerUser(request.body, app.bcrypt));
	});

	app.get("/users", async (request, reply) => {
		reply.send(await getUsers());
	});

	app.get("/users/:id", async (request, reply) => {
		reply.send(await getUserById(request.params.id));
	});


	app.get("/verifyEmail/:id", async (request, reply) => {
		try {
			const { id } = request.params;
			const user = await getUserById(id);

			if (!user) {
				return reply.status(400).send({ error: "Utilisateur non trouvé" });
			}
        
			if (user.verified) {
				return reply.send({ success: "Email déjà vérifié" });
			}

			user.verified = true;
			await user.save();

			reply.send({ success: "Email vérifié avec succès" });
			
		} catch (error) {
			console.error('Erreur de vérification:', error);
			reply.status(400).send({ error: "Erreur lors de la vérification de l'email" });
		}
    });
}
