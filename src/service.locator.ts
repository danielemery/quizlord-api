import { AuthenticationService } from './auth/authentication.service';
import { AuthorisationService } from './auth/authorisation.service';

// auth
export const authenticationService = new AuthenticationService();
export const authorisationService = new AuthorisationService();
