export default class Auth {
    oauth2;

    constructor(credentials) {
        this.oauth2 = require("simple-oauth2").create(credentials)
    }

    getToken() {
        return this.oauth2.clientCredentials
            .getToken()
            .then(this.oauth2.accessToken.create)
            .then(t => {
                return t.token.access_token;
            })
    }

}