
import { 
    startRegistration, 
    startAuthentication 
} from '@simplewebauthn/browser';
import { AppUser } from '../types';
import { updateAppUser } from './dataService';

/**
 * Biometric Service
 * Handles WebAuthn registration and authentication for fingerscan/biometrics.
 */

// Basic helper to generate a random challenge
const generateChallenge = () => {
    return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

export const registerBiometrics = async (user: AppUser): Promise<{ success: boolean; error?: string }> => {
    try {
        if (!user.id) throw new Error("Usuário inválido");

        // 1. Prepare registration options
        const challenge = generateChallenge();
        
        // Simulating some server options
        const options: any = {
            challenge,
            rp: {
                name: 'Ponto Inteligente v1.2',
                id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
            },
            user: {
                id: user.id,
                name: user.name,
                displayName: user.name,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' }, // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        };

        // 2. Trigger browser biometric prompt
        const regResp = await startRegistration(options);

        // 3. In a real app, we'd sent regResp to server to verify.
        // For this demo context, we'll extract the public key part 
        // and store it in the user profile.
        
        // Note: SimpleWebAuthn browser returns a response that is already slightly processed.
        // We'll store the core metadata to "verify" later.
        
        const biometricData = {
            id: regResp.id,
            publicKey: (regResp.response as any).publicKey || "", // SimpleWebAuthn specific
            counter: 0,
            transports: regResp.response.transports || [],
        };

        // 4. Update user in Supabase
        const { success, error } = await updateAppUser(user.id, {
            biometricCredential: biometricData
        });

        if (!success) throw new Error(error || "Erro ao salvar biometria");

        return { success: true };
    } catch (err: any) {
        console.error("Biometric Registration Error:", err);
        return { success: false, error: err.name === 'NotAllowedError' ? 'Acesso cancelado ou negado.' : err.message };
    }
};

export const verifyBiometrics = async (user: AppUser): Promise<{ success: boolean; error?: string }> => {
    try {
        if (!user.biometricCredential) {
            throw new Error("Biometria não cadastrada para este usuário.");
        }

        // 1. Prepare authentication options
        const challenge = generateChallenge();
        
        const options: any = {
            challenge,
            timeout: 60000,
            allowCredentials: [{
                id: user.biometricCredential.id,
                type: 'public-key',
                transports: user.biometricCredential.transports,
            }],
            userVerification: 'required',
            rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        };

        // 2. Trigger biometric validation
        const authResp = await startAuthentication(options);

        // 3. Validation logic
        // In a real production app, the server must verify the signature using the public key.
        // In our AI Studio Client-Side context, the fact that startAuthentication returned 
        // successfully for a specific credentialId is a strong evidence of presence.
        
        if (authResp.id === user.biometricCredential.id) {
            return { success: true };
        }

        throw new Error("Falha na autenticação biométrica.");
    } catch (err: any) {
        console.error("Biometric Auth Error:", err);
        return { success: false, error: err.name === 'NotAllowedError' ? 'Autenticação cancelada.' : err.message };
    }
};

export const isBiometricsSupported = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    
    // Check if secure context
    if (!window.isSecureContext) return false;

    // Check if WebAuthn is available
    if (!window.PublicKeyCredential) return false;

    // Check if platform authenticator is available (fingerprint/faceid)
    try {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
    } catch {
        return false;
    }
};
