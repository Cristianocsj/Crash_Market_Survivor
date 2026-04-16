using UnityEngine;
using UnityEngine.SceneManagement;

public class MenuFases : MonoBehaviour
{
    public void IrParaFase1()
    {
        SceneManager.LoadScene("Fase1");
    }

    public void IrParaFase2()
    {
        SceneManager.LoadScene("Fase2");
    }
    public void VoltarMenu()
    {
        SceneManager.LoadScene("CenaMenu");
    }
}