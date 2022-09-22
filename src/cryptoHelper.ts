import {Env} from "./index";

const algorithm = 'AES-CBC';

export type HashResult = {
    hash: string
    iv: string
}

export const encrypt = async (env: Env, text: string): Promise<HashResult> => {
    const key = await generateImportKey(env);

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const buffer = await crypto.subtle.encrypt(
        {
            name: algorithm,
            iv: iv,
        },
        key,
        stringToBuffer(text),
    );

    return {
        hash: bufferToBase64String(buffer),
        iv: bufferToBase64String(iv)
    }
};

export const decrypt = async (env: Env, hashResult: HashResult) : Promise<string> => {
    const key = await generateImportKey(env);
    const buffer = await crypto.subtle.decrypt(
        {name: algorithm, iv: base64StringToBuffer(hashResult.iv)},
        key,
        base64StringToBuffer(hashResult.hash),
    );

    return atob(bufferToBase64String(buffer))
};


const stringToBuffer = (content: string): ArrayBuffer => {
    return new TextEncoder().encode(content)
}

export const bufferToString = (buffer: ArrayBuffer): string  => {
    return new TextDecoder().decode(buffer).normalize();
}

export const base64StringToBuffer = (content: string): ArrayBuffer => {
    return Uint8Array.from(atob(content), character => character.charCodeAt(0));
}

const bufferToBase64String = (buffer: ArrayBuffer): string => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

const generateImportKey = (env: Env) => {
    const secretKey = (env as any).SECRET_KEY
    if (!secretKey)
        throw new Error("secretKey not found")
    return crypto.subtle.importKey(
        "raw", //can be "jwk" or "raw"
        stringToBuffer(secretKey),
        {   //this is the algorithm options
            name: algorithm,
        },
        false, //whether the key is extractable (i.e. can be used in exportKey)
        ["encrypt", "decrypt"] //can be "encrypt", "decrypt", "wrapKey", or "unwrapKey"
    )
}
