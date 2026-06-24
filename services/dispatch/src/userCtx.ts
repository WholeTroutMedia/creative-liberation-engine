import { db } from './store.js';

export interface UserContext {
    identity: {
        uid: string;
        displayName: string;
        email: string;
        timezone: string;
        preferences: any;
        roles: string[];
    };
    memory: any[];
    agents: any[];
    contacts: any[];
}

/**
 * Loads a comprehensive "tree slice" of the user's data from PostgreSQL.
 * This function serves as the Context Loader for agents to inject
 * localized, sovereign user state into their execution context.
 */
export async function getUserContext(uid: string): Promise<UserContext | null> {
    const userResult = await db().query('SELECT * FROM cle_users WHERE uid = $1 AND is_active = TRUE', [uid]);
    if (userResult.rows.length === 0) return null;
    const user = userResult.rows[0];

    const memoryResult = await db().query('SELECT * FROM cle_user_memory WHERE uid = $1 ORDER BY updated_at DESC', [uid]);
    const agentsResult = await db().query('SELECT * FROM cle_user_agents WHERE uid = $1 AND is_active = TRUE', [uid]);
    const contactsResult = await db().query('SELECT * FROM cle_user_contacts WHERE uid = $1 ORDER BY created_at DESC', [uid]);

    return {
        identity: {
            uid: user.uid,
            displayName: user.display_name,
            email: user.email,
            timezone: user.timezone,
            preferences: user.preferences,
            roles: user.roles,
        },
        memory: memoryResult.rows,
        agents: agentsResult.rows,
        contacts: contactsResult.rows,
    };
}
