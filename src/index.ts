export interface Env {
}

import {parse, serialize} from 'cookie';
import {encrypt, decrypt, base64StringToBuffer, bufferToString} from "./cryptoHelper";

const REALM = "Password Protected Area"
const COOKIE_NAME = '__session';
const COOKIE_DEFAULT_MAX_AGE = 60 * 60 * 24 * 30; // 1 month


class WorkerError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = "WorkerError";
    }
}


const handle = async (request: Request,
                      env: Env,
                      ctx: ExecutionContext): Promise<Response> => {

    const {protocol, pathname} = new URL(request.url);
    if ('https:' !== protocol || 'https' !== request.headers.get('x-forwarded-proto')) {
        return createCustomResponse(204)
    }

    if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
        return createCustomResponse(204)
    }

    if (pathname === '/logout') {
        return logout()
    }

    if (await getSessionCookie(request, env)) {
        console.log("logging via cookie...")
        return await loginViaCookie(request, env)
    }

    if (request.headers.has('Authorization')) {
        console.log("logging via authorization header...")
        return await loginViaBasicAuth(request, env)
    }

    throw new WorkerError(401, "You need to login!")
}

const logout = (): Response => {
    return withDeletingCookies(createCustomResponse(401, 'Logged out!'))
}

const loginViaCookie = async (request: Request, env: Env,): Promise<Response> => {
    const cookie = (await getSessionCookie(request, env))!!.split(":")
    const user = cookie[0]
    const pass = cookie[1]
    return await login(request, env, user!!, pass!!)
}

const loginViaBasicAuth = async (request: Request, env: Env,): Promise<Response> => {
    const authorization = request.headers.get('Authorization');
    const [scheme, encoded] = authorization!!.split(' ');

    if (!encoded || scheme !== 'Basic') {
        throw new WorkerError(400, 'Malformed authorization header.')
    }
    const {user, pass} = decodeAuthorizationHeader(encoded);
    return await login(request, env, user!!, pass!!)
}

const decodeAuthorizationHeader = (encoded: string) => {
    const decoded = bufferToString(base64StringToBuffer(encoded))
    const index = decoded.indexOf(':');
    // The user & password are split by the first colon and MUST NOT contain control characters.
    // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
    if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
        throw new WorkerError(400, 'Invalid authorization value.')
    }

    return {
        user: decoded.substring(0, index),
        pass: decoded.substring(index + 1),
    };
}

const login = async (request: Request, env: Env, user: string, pass: string): Promise<Response> => {
    const adminUsername = (env as any).USERNAME
    const adminPassword = (env as any).PASSWORD
    if (!adminPassword || !adminPassword) {
        throw new WorkerError(500, "admin username and/or password not exist in environment variables.")
    }

    if (adminUsername === user && adminPassword === pass) {
        console.log("Logged in successfully!")
        return await withCreatingCookies(env, user, pass, await fetch(request))
    }
    throw new WorkerError(401, "Invalid Credentials!")
}

const withCreatingCookies = async (env: Env, user: string, password: string, response: Response): Promise<Response> => {
    const newResponse = new Response(response.body, response);
    newResponse.headers.append("Set-Cookie", await serializeForCreatingCookie(env, user, password))
    return newResponse
}

const withDeletingCookies = (response: Response): Response => {
    const newResponse = new Response(response.body, response);
    newResponse.headers.append("Set-Cookie", serializeForDeletingCookie())
    return newResponse
}

const serializeForCreatingCookie = async (env: Env, user: string, password: string): Promise<string> => {
    const value = await encrypt(env, `${user}:${password}`)
    return serialize(COOKIE_NAME, JSON.stringify(value), {
        httpOnly: true,
        maxAge: COOKIE_DEFAULT_MAX_AGE,
        secure: true
    })
}

const serializeForDeletingCookie = (): string => {
    return serialize(COOKIE_NAME, "", {
        httpOnly: true,
        maxAge: -1,
        secure: true
    })
}

const getSessionCookie = async (request: Request, env: Env): Promise<string | null> => {
    const cookie = parse(request.headers.get('Cookie') || '')[COOKIE_NAME]
    if (!cookie)
        return null
    return await decrypt(env, JSON.parse(cookie))
}

const createCustomResponse = (statusCode: number, body?: string): Response => {
    const headers: Record<string, any> = {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Cache-Control': 'no-store',
        'Content-Length': body?.length,
    }
    return new Response(body, {
        status: statusCode,
        headers: headers!!
    });
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        try {
            return await handle(request, env, ctx);
        } catch (e) {
            console.error((e as Error).message)
            if (e instanceof WorkerError) {
                if (e.statusCode >= 500)
                    throw e;

                const response = withDeletingCookies(createCustomResponse(e.statusCode, e.message))
                if (e.statusCode === 401)
                    response.headers.append("WWW-Authenticate", `Basic realm="${REALM}", charset="UTF-8"`)
                return response
            }else if (e instanceof SyntaxError) {
                // for handling cookie schema changes
                return withDeletingCookies(createCustomResponse(500, "An unexpected error has occurred! Please try again later."))
            }
            throw e;
        }
    },
}
