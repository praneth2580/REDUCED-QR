import { Routes, Route } from 'react-router-dom';
import './App.css';
import { routesConfig } from './routes';
import { Navigation } from './components/Navigation';
import Home from './Home';

const renderRoutes = (routes) => {
  return routes.map((route) => {
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
