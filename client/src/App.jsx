import ServerStatsChart from "../components/ServerStatsChart.jsx";
import LoginForm from "../components/LoginForm.jsx";

function App() {
  const isLocalhost = window.location.hostname === "localhost";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Welcome to Server</h1>

      <div className="grid grid-cols-1">
        {/* If not localhost, show login */}
        {!isLocalhost ? (
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">🔐 Login Panel</h2>
            <LoginForm />
          </div>
        ) : (
          <div className="bg-white p-4 rounded shadow">
            <ServerStatsChart />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
