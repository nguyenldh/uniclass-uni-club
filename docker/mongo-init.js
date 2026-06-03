// MongoDB initialization script
// This runs when the container starts for the first time

// Switch to the application database
db = db.getSiblingDB('uniclub');

// Create application user with read/write access
db.createUser({
  user: 'uniclub_app',
  pwd: 'uniclub_password',
  roles: [
    { role: 'readWrite', db: 'uniclub' }
  ]
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ externalId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ createdAt: -1 });

db.user_scores.createIndex({ externalId: 1 });
db.user_scores.createIndex({ 'mind_game.total': -1 });
db.user_scores.createIndex({ 'quiz_arena.total': -1 });

db.game_configs.createIndex({ gameType: 1 }, { unique: true });

db.questions.createIndex({ category: 1 });
db.questions.createIndex({ difficulty: 1 });
db.questions.createIndex({ tags: 1 });

db.bot_profiles.createIndex({ isActive: 1 });

print('MongoDB initialization completed!');
