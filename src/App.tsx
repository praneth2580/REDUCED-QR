import { Routes, Route } from 'react-router-dom';
import './App.css';
import { routesConfig } from './routes';
import { Navigation } from './components/Navigation';
import Home from './Home';
import type { ReactNode } from 'react';

interface RouteConfig {
  path: string;
  element?: ReactNode;
  children?: RouteConfig[];
}

const renderRoutes = (routes: RouteConfig[]) => {
  return routes.map((route: RouteConfig) => {
    const { path, element, children } = route;
    if (children) {
      return (
        <Route key={path} path={path} element={element}>
          {renderRoutes(children)}
        </Route>
      );
    }
    return <Route key={path} path={path} element={element} />;
  });
};

function App() {
  return (
    <div>
      <Navigation />
      <Routes>
        <Route path='/' element={<Home />} />
        {renderRoutes(routesConfig)}
      </Routes>
    </div>
  );
}

export default App;
